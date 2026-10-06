"""Foundation School demo portal — FastAPI backend + static frontend."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import unquote

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel

import demo_data as demo

ROOT = Path(__file__).resolve().parent
SECRET = os.environ.get("PORTAL_SECRET", "foundation-school-demo-secret-change-me")
SESSION_COOKIE = "exam_session"
SESSION_MAX_AGE = 604800
serializer = URLSafeTimedSerializer(SECRET, salt="exam-portal")

app = FastAPI(title="Exam Site Demo", version="1.0.0")


class LoginBody(BaseModel):
    login: str
    password: str


class SubmitBody(BaseModel):
    answers: dict[str, int]
    exit_intent_count: int = 0


def _issue_session(response: Response, user_id: int) -> None:
    token = serializer.dumps({"uid": user_id})
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        max_age=SESSION_MAX_AGE,
        samesite="lax",
        path="/",
    )


def _load_user(session_token: str | None) -> dict[str, Any]:
    if not session_token:
        raise HTTPException(status_code=401, detail="not_authenticated")
    try:
        data = serializer.loads(session_token, max_age=SESSION_MAX_AGE)
    except SignatureExpired as exc:
        raise HTTPException(status_code=401, detail="not_authenticated") from exc
    except BadSignature as exc:
        raise HTTPException(status_code=401, detail="not_authenticated") from exc
    uid = data.get("uid")
    for user in demo.USERS.values():
        if user["id"] == uid:
            return user
    raise HTTPException(status_code=401, detail="not_authenticated")


def current_user(
    exam_session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> dict[str, Any]:
    return _load_user(exam_session)


def _find_user_by_login(login: str) -> dict[str, Any] | None:
    key = login.strip().lower()
    for user in demo.USERS.values():
        if user["login"].lower() == key:
            return user
    return None


def _exam_or_404(exam_id: int) -> dict[str, Any]:
    ex = demo.EXAMS.get(exam_id)
    if not ex:
        raise HTTPException(status_code=404, detail="exam_not_found")
    return ex


def _student_preview(exam_id: int, user: dict[str, Any]) -> dict[str, Any]:
    ex = _exam_or_404(exam_id)
    sub = demo.student_submissions.get((exam_id, user["id"]))
    submitted = sub is not None or ex["catalog_key"] == "done"
    score = sub["score_percent"] if sub else (88 if ex["catalog_key"] == "done" else None)
    feedback = sub.get("feedback") if sub else None
    return {
        "exam": {k: v for k, v in ex.items() if k != "questions"},
        "questions": ex["questions"],
        "show_answers": False,
        "submitted": submitted,
        "score_percent": score,
        "feedback": feedback,
    }


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(ROOT / "index.html", headers={"Cache-Control": "no-cache"})


app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/api/public/landing")
async def public_landing() -> dict[str, Any]:
    return {"has_schools": True, "school_name": demo.SCHOOL_NAME}


@app.post("/api/login")
async def login(body: LoginBody, response: Response) -> dict[str, Any]:
    user = _find_user_by_login(body.login)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="invalid_credentials")
    _issue_session(response, user["id"])
    return demo.session_payload(user)


@app.post("/api/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"status": "ok"}


@app.get("/api/me")
async def me(user: Annotated[dict[str, Any], Depends(current_user)]) -> dict[str, Any]:
    return demo.session_payload(user)


@app.get("/api/portal/classes")
async def portal_classes(user: Annotated[dict[str, Any], Depends(current_user)]) -> list[dict[str, Any]]:
    if user["role"] not in {"admin", "teacher"}:
        raise HTTPException(status_code=403, detail="forbidden")
    return demo.CLASSES


@app.get("/api/portal/staff/tests")
async def portal_staff_tests(user: Annotated[dict[str, Any], Depends(current_user)]) -> dict[str, Any]:
    if user["role"] not in {"admin", "teacher"}:
        raise HTTPException(status_code=403, detail="forbidden")
    return {"tests": demo.staff_tests_list()}


@app.get("/api/portal/class/{class_name}/subjects")
async def portal_class_subjects(
    class_name: str,
    user: Annotated[dict[str, Any], Depends(current_user)],
) -> dict[str, Any]:
    if user["role"] not in {"admin", "teacher"}:
        raise HTTPException(status_code=403, detail="forbidden")
    cls = unquote(class_name)
    return {"subjects": demo.SUBJECTS, "class_name": cls}


@app.get("/api/portal/class/{class_name}/subjects/{subject_code}/tests")
async def portal_class_subject_tests(
    class_name: str,
    subject_code: str,
    user: Annotated[dict[str, Any], Depends(current_user)],
) -> dict[str, Any]:
    cls = unquote(class_name)
    subject = next((s for s in demo.SUBJECTS if s["code"] == subject_code), None)
    if not subject:
        raise HTTPException(status_code=404, detail="subject_not_found")
    tests = demo.tests_for_class_subject(cls, subject_code)
    if user["role"] == "student":
        for t in tests:
            sub = demo.student_submissions.get((t["id"], user["id"]))
            t["submitted"] = sub is not None or t["catalog_key"] == "done"
            t["student_label"] = "Сдано" if t["submitted"] else "К сдаче"
    return {"subject_title": subject["title"], "tests": tests}


@app.get("/api/portal/exams/{exam_id}/admin")
async def portal_exam_admin(
    exam_id: int,
    user: Annotated[dict[str, Any], Depends(current_user)],
) -> dict[str, Any]:
    if user["role"] not in {"admin", "teacher"}:
        raise HTTPException(status_code=403, detail="forbidden")
    ex = _exam_or_404(exam_id)
    students = demo.STUDENTS_6B if ex["class_name"] == "6Б" else []
    submitted = [s for s in students if s["status"] == "submitted"]
    question_stats, problem_questions = demo.build_question_analytics(
        exam_id, ex["questions"], students
    )
    return {
        "exam": {k: v for k, v in ex.items() if k != "questions"},
        "questions": ex["questions"],
        "students": students,
        "problem_questions": problem_questions,
        "question_stats": question_stats,
        "submitted_count": len(submitted),
        "class_total": len(students) or 24,
        "all_submitted": len(submitted) >= (len(students) or 1),
        "teacher_report_sent": exam_id in demo.teacher_report_sent,
    }


@app.get("/api/portal/exams/{exam_id}/preview")
async def portal_exam_preview(
    exam_id: int,
    user: Annotated[dict[str, Any], Depends(current_user)],
) -> dict[str, Any]:
    if user["role"] in {"admin", "teacher"}:
        ex = _exam_or_404(exam_id)
        return {
            "exam": {k: v for k, v in ex.items() if k != "questions"},
            "questions": ex["questions"],
            "show_answers": True,
            "submitted": False,
            "score_percent": None,
        }
    return _student_preview(exam_id, user)


@app.post("/api/portal/exams/{exam_id}/submit")
async def portal_exam_submit(
    exam_id: int,
    body: SubmitBody,
    user: Annotated[dict[str, Any], Depends(current_user)],
) -> dict[str, Any]:
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="forbidden")
    ex = _exam_or_404(exam_id)
    questions = ex["questions"]
    correct = 0
    feedback: list[dict[str, Any]] = []
    for i, q in enumerate(questions):
        selected = int(body.answers.get(str(i), 0))
        ok = selected == q["correct_index"]
        if ok:
            correct += 1
        feedback.append({"selected_index": selected, "is_correct": ok})
    total = len(questions) or 1
    score = round(100 * correct / total)
    demo.student_submissions[(exam_id, user["id"])] = {
        "score_percent": score,
        "correct_count": correct,
        "question_total": total,
        "feedback": feedback,
        "answers": {str(i): int(body.answers.get(str(i), 0)) for i in range(total)},
        "exit_intent_count": body.exit_intent_count,
    }
    return {
        "score_percent": score,
        "correct_count": correct,
        "question_total": total,
        "duration_label": "10:42",
    }


@app.post("/api/portal/exams/{exam_id}/send-teacher-report")
async def portal_send_teacher_report(
    exam_id: int,
    user: Annotated[dict[str, Any], Depends(current_user)],
) -> dict[str, str]:
    if user["role"] not in {"admin", "teacher"}:
        raise HTTPException(status_code=403, detail="forbidden")
    data = await portal_exam_admin(exam_id, user)
    if not data["all_submitted"]:
        raise HTTPException(status_code=400, detail="not_all_submitted")
    demo.teacher_report_sent.add(exam_id)
    return {"status": "sent"}


@app.get("/api/portal/my/subjects")
async def portal_my_subjects(user: Annotated[dict[str, Any], Depends(current_user)]) -> dict[str, Any]:
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="forbidden")
    cls = user.get("class_name") or "6Б"
    return {"class_name": cls, "subjects": demo.SUBJECTS}


@app.get("/api/portal/my/completed-tests")
async def portal_my_completed(user: Annotated[dict[str, Any], Depends(current_user)]) -> dict[str, Any]:
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="forbidden")
    tests = []
    for (exam_id, uid), sub in demo.student_submissions.items():
        if uid != user["id"]:
            continue
        ex = demo.EXAMS.get(exam_id)
        if not ex:
            continue
        tests.append(
            {
                "exam_id": exam_id,
                "title": ex["title"],
                "subject_title": ex["subject_title"],
                "control_date": ex["control_date"],
                "score_percent": sub["score_percent"],
                "correct_count": sub["correct_count"],
                "question_total": sub["question_total"],
                "duration_label": sub.get("duration_label", "10:42"),
                "score_line": f"{sub['score_percent']}%",
            }
        )
    return {"tests": tests}
