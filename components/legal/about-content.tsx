import { LegalSection } from "@/components/legal/legal-section";

const capabilities = [
  [
    "Confirm what was agreed",
    "Create a clear booking and give the customer an easy way to review what was agreed.",
  ],
  [
    "Keep customers updated",
    "Send important booking updates through supported communication channels such as Email and optional WhatsApp.",
  ],
  [
    "Manage changes clearly",
    "Record reschedules, amendments and add-ons without losing the history of what changed.",
  ],
  [
    "Track the journey",
    "Follow work from confirmation through fulfilment, delivery and completion.",
  ],
  [
    "Keep payment records clear",
    "Record agreed totals, deposits and subsequent payments while keeping the outstanding balance visible.",
  ],
  [
    "Learn from every job",
    "Collect private customer feedback after delivery and use the experience to improve future service.",
  ],
] as const;

export function AboutContent() {
  return (
    <div className="space-y-6 text-[0.9375rem] leading-7 text-muted-foreground sm:text-base">
      <div className="space-y-3">
        <p className="text-xl font-semibold leading-7 text-foreground sm:text-2xl">
          Keep every customer in the loop.
        </p>
        <p>
          My Kustomers helps businesses manage what happens after a customer says yes.
        </p>
        <p>
          From booking confirmation through updates, changes, delivery and feedback, the
          platform keeps the customer journey clear and organized in one place.
        </p>
      </div>
      <section aria-labelledby="about-why" className="space-y-3">
        <h2 id="about-why" className="text-lg font-semibold text-foreground">
          Why it exists
        </h2>
        <p>
          Too many customer jobs are managed across scattered messages, calls, notes and
          memory.
        </p>
        <p>That can make it difficult for both businesses and customers to know:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>what was agreed;</li>
          <li>what happens next;</li>
          <li>whether something changed;</li>
          <li>when the work will be ready;</li>
          <li>whether payment has been recorded;</li>
          <li>whether the customer was satisfied.</li>
        </ul>
        <p>My Kustomers brings those moments together.</p>
      </section>
      <div className="space-y-3">
        {capabilities.map(([title, body], index) => (
          <LegalSection
            key={title}
            number={index + 1}
            title={title}
            defaultOpen={index === 0}
          >
            <p>{body}</p>
          </LegalSection>
        ))}
      </div>
      <section aria-labelledby="about-who" className="space-y-3">
        <h2 id="about-who" className="text-lg font-semibold text-foreground">
          Who it is for
        </h2>
        <p>
          My Kustomers is built for service businesses — from independent operators to
          growing teams — where the work continues after the customer places an order or
          agrees to a service.
        </p>
      </section>
      <p className="border-t border-border pt-5 font-medium text-foreground">
        Sell where you already sell.
        <br />
        My Kustomers helps manage what happens next.
      </p>
    </div>
  );
}
