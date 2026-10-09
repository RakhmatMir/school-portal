/** Smoke checks for roster / bundle submission rules (no browser). */
import fs from "fs";

const bundle = JSON.parse(fs.readFileSync("data/portal.json", "utf8"));
const className = "6Б";
const roster = bundle.rosters[className];
const exams = bundle.exams.filter((e) => e.class_name === className);

function submissionKey(examId, userId) {
  return `${examId}:${userId}`;
}

function studentBundleFullySubmitted(submissions, studentId) {
  for (const ex of exams) {
    if (!submissions[submissionKey(ex.id, studentId)]) return false;
  }
  return true;
}

function classBundleFullySubmitted(submissions) {
  for (const row of roster) {
    if (!studentBundleFullySubmitted(submissions, row.id)) return false;
  }
  return true;
}

const empty = {};
console.assert(roster.length === 18, "roster must be 18");
console.assert(exams.length === 3, "expect 3 exams");
console.assert(!classBundleFullySubmitted(empty), "empty subs not complete");

const partial = {};
partial[submissionKey(exams[0].id, roster[0].id)] = { score_percent: 50 };
console.assert(!classBundleFullySubmitted(partial), "one exam not enough");

for (const row of roster) {
  for (const ex of exams) {
    partial[submissionKey(ex.id, row.id)] = { score_percent: 80 };
  }
}
console.assert(classBundleFullySubmitted(partial), "full grid complete");

console.log("verify-portal-logic: ok");
