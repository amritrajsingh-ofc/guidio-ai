import { AnswerComposer } from "./answer-composer";
import { AnswerFeedback } from "./answer-feedback";
import { InterviewProgress } from "./interview-progress";
import { InterviewResult } from "./interview-result";
import { StalledState } from "./interview-states";
import { QuestionCard } from "./question-card";
import {
  getAnsweredCount,
  getCurrentQuestion,
  getQuestionSteps,
} from "./interview-utils";

/**
 * The screen for one interview: the open question, the feedback of an
 * answered question, or the final result.
 */
export function InterviewSession({
  interview,
  viewedQuestionId,
  onSelectQuestion,
  answerText,
  onAnswerChange,
  onSubmit,
  isSubmitting,
  submitError,
  cooldown,
  onNew,
  onRefresh,
  isRefreshing,
  refreshError,
}) {
  if (interview.status === "COMPLETED") {
    return (
      <InterviewResult
        interview={interview}
        onNew={onNew}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        refreshError={refreshError}
      />
    );
  }

  const steps = getQuestionSteps(interview);
  const current = getCurrentQuestion(interview);

  const viewedStep = viewedQuestionId
    ? steps.find(
        (step) => step.status === "answered" && step.question?.id === viewedQuestionId
      )
    : null;

  const currentStep = current
    ? steps.find((step) => step.question?.id === current.id)
    : null;

  const activeQuestionId = viewedStep?.question.id ?? current?.id ?? null;

  function handleSelect(step) {
    onSelectQuestion(step.status === "answered" ? step.question.id : null);
  }

  return (
    <div className="max-w-4xl space-y-5">
      <InterviewProgress
        interview={interview}
        steps={steps}
        activeQuestionId={activeQuestionId}
        onSelect={handleSelect}
        disabled={isSubmitting}
      />

      {viewedStep ? (
        <>
          <QuestionCard
            number={viewedStep.number}
            total={steps.length}
            question={viewedStep.question}
          />

          <AnswerFeedback
            answer={viewedStep.question.answer}
            onContinue={current ? () => onSelectQuestion(null) : undefined}
            continueLabel={`Continue to question ${currentStep?.number ?? ""}`.trim()}
          />
        </>
      ) : current ? (
        <>
          <QuestionCard
            number={currentStep?.number ?? getAnsweredCount(interview) + 1}
            total={steps.length}
            question={current}
          />

          <AnswerComposer
            value={answerText}
            onChange={onAnswerChange}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            submitError={submitError}
            cooldown={cooldown}
          />
        </>
      ) : null}

      {!current ? (
        <StalledState hasAnswers={getAnsweredCount(interview) > 0} onNew={onNew} />
      ) : null}
    </div>
  );
}