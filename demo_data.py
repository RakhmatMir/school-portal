"""In-memory demo data for Foundation School portal."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

SCHOOL_NAME = "Foundation School — демо"

USERS: dict[str, dict[str, Any]] = {
    "admin": {
        "id": 1,
        "password": "admin123",
        "login": "admin",
        "full_name": "Главный админ",
        "role": "admin",
        "class_name": None,
        "staff_title": None,
    },
    "teacher": {
        "id": 2,
        "password": "teacher123",
        "login": "teacher",
        "full_name": "Абдурашид (учитель)",
        "role": "teacher",
        "class_name": None,
        "staff_title": None,
    },
    "student1": {
        "id": 4,
        "password": "student123",
        "login": "student1",
        "full_name": "Алиев Дилшод",
        "role": "student",
        "class_name": "6Б",
        "staff_title": None,
    },
}

CLASSES = [
    {"class_name": "6Б", "student_count": 24, "test_count": 5},
    {"class_name": "7-A", "student_count": 22, "test_count": 4},
    {"class_name": "8-A", "student_count": 26, "test_count": 6},
]

SUBJECTS = [
    {"code": "math", "title": "Математика", "test_count": 2},
    {"code": "english", "title": "Английский язык", "test_count": 2},
    {"code": "physics", "title": "Физика", "test_count": 1},
]

SAMPLE_QUESTIONS = [
    {
        "text": "Сколько будет 12 + 8?",
        "options": ["18", "20", "21", "19"],
        "correct_index": 1,
    },
    {
        "text": "Choose the correct form: She ___ to school every day.",
        "options": ["go", "goes", "going", "gone"],
        "correct_index": 1,
    },
    {
        "text": "Единица силы в SI — это…",
        "options": ["Джоуль", "Ньютон", "Паскаль", "Ватт"],
        "correct_index": 1,
    },
]

EXAMS: dict[int, dict[str, Any]] = {
    101: {
        "id": 101,
        "class_name": "6Б",
        "subject_code": "math",
        "subject_title": "Математика",
        "title": "Контрольная №2 — дроби",
        "control_date": "04.10.2026",
        "duration_minutes": 13,
        "kind_label": "Контрольная",
        "phase": "active",
        "catalog_key": "todo",
        "question_count": 3,
        "questions": deepcopy(SAMPLE_QUESTIONS),
    },
    102: {
        "id": 102,
        "class_name": "6Б",
        "subject_code": "english",
        "subject_title": "Английский язык",
        "title": "Unit 5 — Grammar",
        "control_date": "01.10.2026",
        "duration_minutes": 15,
        "kind_label": "Тест",
        "phase": "done",
        "catalog_key": "done",
        "question_count": 3,
        "questions": deepcopy(SAMPLE_QUESTIONS),
    },
    103: {
        "id": 103,
        "class_name": "7-A",
        "subject_code": "math",
        "subject_title": "Математика",
        "title": "Алгебра — линейные уравнения",
        "control_date": "03.10.2026",
        "duration_minutes": 20,
        "kind_label": "Самостоятельная",
        "phase": "active",
        "catalog_key": "todo",
        "question_count": 3,
        "questions": deepcopy(SAMPLE_QUESTIONS),
    },
}

STUDENTS_6B = [
    {"id": 4, "full_name": "Алиев Дилшод", "status": "not_started", "score_percent": None},
    {"id": 5, "full_name": "Karimova Malika", "status": "submitted", "score_percent": 88, "duration_label": "11:20", "exit_intent_count": 0},
    {"id": 6, "full_name": "Rustamov Bek", "status": "submitted", "score_percent": 72, "duration_label": "12:05", "exit_intent_count": 1, "exit_intent_label": "1 раз"},
]

# Demo: selected option index per question for submitted students (exam_id, user_id).
EXAM_DEMO_ANSWERS: dict[tuple[int, int], list[int]] = {
    (101, 5): [1, 1, 1],
    (101, 6): [1, 0, 2],
    (102, 5): [1, 1, 1],
    (102, 6): [1, 1, 0],
}

PROBLEM_QUESTION_THRESHOLD_PERCENT = 40

# Mutable submission state keyed by (exam_id, user_id)
student_submissions: dict[tuple[int, int], dict[str, Any]] = {}
teacher_report_sent: set[int] = set()


def _answers_for_student(exam_id: int, student: dict[str, Any], questions: list[dict[str, Any]]) -> list[int] | None:
    key = (exam_id, student["id"])
    if key in EXAM_DEMO_ANSWERS:
        return EXAM_DEMO_ANSWERS[key]
    live = student_submissions.get(key)
    if live and live.get("answers"):
        ans = live["answers"]
        return [int(ans[str(i)]) for i in range(len(questions))]
    if student.get("status") != "submitted":
        return None
    # Fallback: infer mostly-correct attempt from score_percent.
    total = len(questions) or 1
    pct = student.get("score_percent") or 0
    wrong = max(0, round(total * (100 - pct) / 100))
    picks = [q["correct_index"] for q in questions]
    for i in range(min(wrong, total)):
        picks[-(i + 1)] = (picks[-(i + 1)] + 1) % 4
    return picks


def build_question_analytics(
    exam_id: int,
    questions: list[dict[str, Any]],
    students: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Per-question fail rates and «hard» questions derived from the same data."""
    submitted = [s for s in students if s.get("status") == "submitted"]
    submitted_total = len(submitted)
    stats: list[dict[str, Any]] = []
    for qi, q in enumerate(questions):
        failed = 0
        if submitted_total:
            for st in submitted:
                picks = _answers_for_student(exam_id, st, questions)
                if picks is None or qi >= len(picks):
                    failed += 1
                elif picks[qi] != q["correct_index"]:
                    failed += 1
        failed_percent = round(100 * failed / submitted_total) if submitted_total else 0
        stats.append(
            {
                "submitted_total": submitted_total,
                "failed_count": failed,
                "failed_percent": failed_percent,
            }
        )

    problem: list[dict[str, Any]] = []
    if submitted_total:
        for qi, st in enumerate(stats):
            if st["failed_percent"] >= PROBLEM_QUESTION_THRESHOLD_PERCENT:
                problem.append({"index": qi, "failed_percent": st["failed_percent"]})
        problem.sort(key=lambda row: (-row["failed_percent"], row["index"]))
    return stats, problem


def public_user(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": raw["id"],
        "login": raw["login"],
        "full_name": raw["full_name"],
        "role": raw["role"],
        "class_name": raw.get("class_name"),
        "staff_title": raw.get("staff_title"),
    }


def session_payload(user: dict[str, Any]) -> dict[str, Any]:
    return {"user": public_user(user), "school_name": SCHOOL_NAME}


def tests_for_class_subject(class_name: str, subject_code: str) -> list[dict[str, Any]]:
    rows = []
    for ex in EXAMS.values():
        if ex["class_name"] == class_name and ex["subject_code"] == subject_code:
            rows.append(
                {
                    "id": ex["id"],
                    "title": ex["title"],
                    "control_date": ex["control_date"],
                    "kind_label": ex["kind_label"],
                    "phase": ex["phase"],
                    "catalog_key": ex["catalog_key"],
                    "duration_minutes": ex["duration_minutes"],
                    "question_count": ex["question_count"],
                    "submitted_count": 2 if ex["catalog_key"] == "done" else 0,
                    "class_total": 24,
                }
            )
    return rows


def staff_tests_list() -> list[dict[str, Any]]:
    tests = []
    for ex in EXAMS.values():
        tests.append(
            {
                "id": ex["id"],
                "class_name": ex["class_name"],
                "subject_code": ex["subject_code"],
                "subject_title": ex["subject_title"],
                "title": ex["title"],
                "control_date": ex["control_date"],
                "kind_label": ex["kind_label"],
                "catalog_key": ex["catalog_key"],
                "question_count": ex["question_count"],
                "submitted_count": 2 if ex["catalog_key"] == "done" else 0,
                "class_total": 24,
            }
        )
    return tests
