import { CalendarDays, CalendarClock } from "lucide-react";
import { LegalSection } from "@/components/legal/legal-section";

export const TERMS_DATE = "8 October 2026";

const sections = [
  [
    "About My Kustomers",
    "My Kustomers helps businesses manage customer bookings, confirmations, updates, delivery-related workflows and feedback. It provides software to support the workflow between businesses and their customers.",
  ],
  [
    "Accounts",
    "Keep your account and business information accurate, protect your login credentials, and allow only authorised members to use your account. You are responsible for authorised activity through your account and should report suspected unauthorised access promptly.",
  ],
  [
    "Business–customer relationship",
    "The business selling goods or services remains responsible for its pricing, fulfilment, delivery, refunds, taxes, customer disputes and legal or regulatory obligations. My Kustomers is not a party to the underlying customer transaction merely because it is recorded on the platform.",
  ],
  [
    "Bookings and confirmations",
    "Secure customer links may allow customers to review and confirm bookings, approve amendments or add-ons, and provide feedback. Businesses must check the accuracy of booking information before sending it. A confirmation records what was presented and confirmed through the platform; it does not independently guarantee fulfilment or payment.",
  ],
  [
    "Payments and financial information",
    "The platform records booking totals, deposits, subsequent payments and outstanding balances. Unless a separate payment product is explicitly provided, My Kustomers is not a bank, payment processor, escrow service or independent verifier of payment. Amounts marked as paid or recorded reflect information entered or confirmed through the relevant workflow. Businesses must verify actual receipt of money.",
  ],
  [
    "Customer communications",
    "Enabled features may provide transactional email, WhatsApp, push or in-app notifications. Businesses must provide accurate recipient details, have the appropriate permission or consent to contact customers, respect opt-outs, and use messaging for legitimate customer and business communications. Delivery, reading or action on every message cannot be guaranteed.",
  ],
  [
    "WhatsApp",
    "WhatsApp updates depend on third-party infrastructure and may be delayed, interrupted or unavailable. Businesses remain responsible for customer consent and contact accuracy. Do not use this feature for spam, bulk unsolicited marketing or unlawful messaging.",
  ],
  [
    "Customer data",
    "Only upload or process customer information that you are entitled to use. Businesses remain responsible for their applicable privacy and data-protection obligations concerning their customers. My Kustomers uses customer information as necessary to provide the platform and its enabled services, subject to its privacy practices and applicable law.",
  ],
  [
    "Acceptable use",
    "Do not use the platform for unlawful activity, fraud, harassment, impersonation or spam. Do not attempt unauthorised access, upload malicious content, abuse messaging or email infrastructure, or interfere with the security or availability of the service.",
  ],
  [
    "Third-party services",
    "My Kustomers relies on third-party services for hosting, authentication, data storage, email delivery and messaging. Their availability may affect platform functionality. Any separately applicable third-party terms remain relevant to your use of those services.",
  ],
  [
    "Availability and changes",
    "We make reasonable efforts to provide a reliable service, but cannot guarantee uninterrupted availability. Features may be improved, changed, added or removed. Where a change materially affects your use of the service, we will provide appropriate notice and respect any rights you have under applicable law.",
  ],
  [
    "Suspension and termination",
    "Access may be suspended where reasonably necessary to address security concerns, abuse, unlawful activity, material breaches of these Terms or risks to other users or the platform. Where appropriate, we will explain the reason and any steps needed to restore access. You may stop using the service. This does not remove obligations or rights that already arose.",
  ],
  [
    "Intellectual property",
    "My Kustomers retains rights in its software, branding, designs and documentation, except for user, business and customer content and third-party materials. You retain rights in your legitimate business content and permit its use as needed to provide the platform services you use.",
  ],
  [
    "Disclaimer and liability",
    "To the fullest extent permitted by applicable law, My Kustomers does not guarantee commercial outcomes from using the platform. Businesses remain responsible for their own fulfilment and customer relationships. Nothing in these Terms excludes or limits liability or statutory rights that cannot lawfully be excluded or limited.",
  ],
  [
    "Changes to these Terms",
    "These Terms may be updated as the service or applicable requirements change. Material changes will be communicated appropriately. The effective and last-updated dates identify the current wording. An update does not remove rights that have already arisen.",
  ],
  [
    "Contact",
    "For questions about a booking, payment, delivery or the goods or services you purchased, contact the business identified in that booking using the contact details it has provided.",
  ],
] as const;

export function TermsContent() {
  return (
    <div className="break-words">
      <dl className="mb-5 grid grid-cols-2 gap-3 border-b border-border pb-5 sm:mb-6 sm:gap-6 sm:pb-6">
        {(
          [
            ["Effective date", CalendarDays],
            ["Last updated", CalendarClock],
          ] as const
        ).map(([label, Icon]) => (
          <div
            key={String(label)}
            className="flex min-w-0 flex-col items-start gap-2 min-[375px]:flex-row min-[375px]:items-center sm:gap-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.06] text-primary sm:size-11">
              <Icon className="size-5 sm:size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <dt className="text-[0.8125rem] leading-5 text-muted-foreground sm:text-sm">
                {String(label)}
              </dt>
              <dd className="text-base leading-6">{TERMS_DATE}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div className="space-y-3">
        {sections.map(([title, body], index) => (
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
    </div>
  );
}
