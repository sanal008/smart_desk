from __future__ import annotations

import json
import random
from pathlib import Path

RNG = random.Random(42)

CATEGORIES = ["billing", "technical", "refund", "account", "shipping", "security"]

TEMPLATES: dict[str, list[tuple[str, str]]] = {
    "billing": [
        (
            "Duplicate charge on invoice {inv}",
            "Hi, I was charged twice for my {plan} plan on invoice {inv}. "
            "The amount {amount} was taken from my card on the same day twice. "
            "Please reverse the extra charge. I have attached the bank statement.",
        ),
        (
            "Wrong invoice amount for {month}",
            "Our invoice {inv} for {month} shows {amount} but our plan is only supposed to cost "
            "{amount2}. Can someone explain the discrepancy and issue a corrected invoice?",
        ),
        (
            "Need a VAT invoice for {month}",
            "We need a proper VAT invoice for {month} with our company VAT number included. "
            "The current PDF does not show the tax breakdown we need for accounting.",
        ),
        (
            "Upgrade charge not prorated",
            "I upgraded from the {plan} plan mid-cycle and was charged the full {amount} instead "
            "of a prorated amount. This feels wrong and I would like it corrected today.",
        ),
        (
            "Payment failed but money was taken",
            "My payment shows as failed in your dashboard, but {amount} was definitely deducted "
            "from my card. I have the transaction reference. Please investigate urgently.",
        ),
        (
            "Question about {plan} plan pricing",
            "Could you clarify what is included in the {plan} plan? Specifically whether "
            "API access and priority support are part of the {amount} monthly price.",
        ),
        (
            "Invoice sent to the wrong billing contact",
            "Invoices for account {acct} are still going to our old finance manager. "
            "Please update the billing contact to our new address so we stop missing payments.",
        ),
        (
            "Refund of unused seats",
            "We paid for 25 seats but only 12 are in use. Can we get credited for the unused "
            "seats on the next invoice, or is a refund possible?",
        ),
        (
            "Charge after cancellation",
            "I cancelled my subscription last week but was still charged {amount} yesterday. "
            "Please refund this immediately and confirm the cancellation is complete.",
        ),
        (
            "Annual plan renewal receipt needed",
            "Our annual plan {plan} renewed on {month}. Please send the receipt showing the "
            "{amount} charge so I can expense it.",
        ),
    ],
    "technical": [
        (
            "API returning 500 errors since this morning",
            "All calls to /api/v2/orders are returning HTTP 500 starting around 09:00 UTC. "
            "This is breaking our checkout flow in production. Stack trace attached. "
            "We need this escalated to engineering urgently.",
        ),
        (
            "Dashboard loads with a blank screen",
            "After logging in, the dashboard shows a blank white screen. Browser console shows "
            "a React error about a failed chunk load. Hard refresh does not help. Using Chrome {ver}.",
        ),
        (
            "Mobile app crashes on the reports tab",
            "The iOS app (version {ver}) crashes every time I open the Reports tab. "
            "It worked fine before the last update. Device is iPhone {dev}.",
        ),
        (
            "Webhook deliveries are delayed",
            "Our webhooks are arriving 20-30 minutes late since yesterday. Payloads look fine, "
            "just late. This is causing sync failures with our CRM.",
        ),
        (
            "Cannot upload files larger than 5MB",
            "File uploads fail with a network error for anything above 5MB. Smaller files work. "
            "We need to upload 20MB PDFs for our workflow. Is there a limit we can raise?",
        ),
        (
            "SSO login loop after enabling SAML",
            "After configuring SAML with Okta, users get stuck in a login redirect loop. "
            "Logs from our IdP are attached. This blocks the whole team from signing in.",
        ),
        (
            "Export to CSV produces empty file",
            "Clicking Export to CSV downloads a 0-byte file. Happens for the last 3 exports. "
            "The on-screen data is correct, only the export is broken.",
        ),
        (
            "Integration with Salesforce stopped syncing",
            "Our Salesforce integration last synced {hours} hours ago and shows a connection error. "
            "Nothing changed on our side. Please look into this.",
        ),
        (
            "Slow page loads on the orders screen",
            "The orders screen takes over 15 seconds to load since we crossed 10k records. "
            "It used to be instant. This is slowing down our support team.",
        ),
        (
            "Two-factor codes not being delivered",
            "SMS two-factor codes are not arriving for any of our users today. "
            "We have confirmed the phone numbers are correct. Everyone is locked out.",
        ),
    ],
    "refund": [
        (
            "Request refund for double billing",
            "I was billed twice for {month} (see invoice {inv}). I would like a full refund of "
            "{amount} back to my original payment method, not account credit.",
        ),
        (
            "Refund for service outage last week",
            "Last week's outage took the service down for 6 hours during our peak time. "
            "Per your SLA we are owed a refund. Please process it this week.",
        ),
        (
            "Cancel and refund remaining balance",
            "We are cancelling our subscription. Please refund the unused portion of our "
            "annual plan ({amount} remaining) within 14 days as required.",
        ),
        (
            "Refund request - wrong item ordered",
            "We ordered the {plan} plan by mistake and meant to pick a different one. "
            "Nothing has been used. Can we get a refund and reorder the correct plan?",
        ),
        (
            "Charged after free trial ended",
            "I was charged {amount} the day after the free trial ended. I cancelled the trial "
            "on the last day, but the charge still went through. Please refund it.",
        ),
        (
            "Refund not received after 30 days",
            "You confirmed a refund on my ticket {ticket} over 30 days ago for {amount}. "
            "I still have not seen the money. This is unacceptable, please escalate.",
        ),
        (
            "Pro-rated refund for downgrade",
            "We downgraded from {plan} last month and were told we would get a pro-rated "
            "refund of about {amount}. It has not appeared. Please process it.",
        ),
        (
            "Legal action if refund is not processed",
            "Three requests for a {amount} refund have been ignored. If I do not get a response "
                    "within 48 hours I will be forced to involve my bank and seek legal advice.",
        ),
    ],
    "account": [
        (
            "Cannot reset my password",
            "The password reset email never arrives. I have checked spam and tried three "
            "different addresses. I am locked out of account {acct} and need access today.",
        ),
        (
            "Add a new admin user to our workspace",
            "Please add jane.doe@example.com as an administrator on workspace {acct}. "
            "She is our new IT lead and needs full access rights.",
        ),
        (
            "Merge two duplicate accounts",
            "We have two accounts under the same company email domain. Can you merge them "
            "so all our ticket history is in one place?",
        ),
        (
            "Change the account owner email",
            "Our previous owner has left the company. Please transfer ownership of account "
            "{acct} to my email so we can manage billing and users.",
        ),
        (
            "Deactivate a former employee",
            "Please deactivate the user mark.smith@example.com immediately. He left the company "
            "yesterday and should no longer have access to our data.",
        ),
        (
            "Locked out after too many login attempts",
            "My account got locked after failed login attempts. I need it unlocked and would "
            "like to set up SSO so this does not happen again.",
        ),
        (
            "Update company name on the account",
            "We rebranded last month. Please update the company name on account {acct} from "
            "the old name to our new legal entity name for invoices.",
        ),
        (
            "Export all data for our account (GDPR)",
            "Under GDPR we request a full export of all personal data held for account {acct}. "
            "Please provide it within 30 days in a machine-readable format.",
        ),
    ],
    "shipping": [
        (
            "Order {order} has not arrived",
            "My order {order} was supposed to arrive on {date} but tracking has not updated "
            "in 5 days. Can you please check where it is and expedite?",
        ),
        (
            "Wrong item received for order {order}",
            "I received a completely different product from order {order}. The packing slip "
            "matches but the contents do not. I need the correct item sent out urgently.",
        ),
        (
            "Package marked delivered but not here",
            "Tracking says my package was delivered yesterday, but nothing arrived at our "
            "reception. Please investigate with the carrier and arrange a reship.",
        ),
        (
            "Damaged item on delivery",
            "Order {order} arrived with the outer box crushed and the product scratched. "
            "Photos attached. I would like a replacement or refund.",
        ),
        (
            "Need to change the delivery address",
            "Order {order} has not shipped yet. Please change the delivery address to our "
            "new warehouse before it goes out.",
        ),
        (
            "Express shipping upgrade for order {order}",
            "We need order {order} by {date} for a client launch. Can you upgrade it to "
            "express shipping and tell us the extra cost?",
        ),
        (
            "Missing items from order {order}",
            "Order {order} arrived with two of the five line items missing. The box was "
            "unsealed. Please ship the missing items or refund them.",
        ),
        (
            "Customs charge on delivered order",
            "I was charged {amount} in customs fees on order {order} even though shipping "
            "was advertised as DDP. Please reimburse this.",
        ),
    ],
    "security": [
        (
            "Suspicious login on our account",
            "We saw logins on account {acct} from an unfamiliar IP in another country at 3am. "
            "We did not authorise this. Please lock the account and help us rotate credentials.",
        ),
        (
            "Suspected phishing email using your brand",
            "We received an email that looks like it is from your team asking us to re-enter "
            "billing details. Header analysis attached. Please confirm whether it is legitimate.",
       ),
        (
            "Report a vulnerability in your API",
            "I discovered an IDOR issue in the /api/v2/invoices endpoint that exposes other "
            "tenants' invoices. I would like to report this responsibly. Details attached.",
       ),
        (
            "Data breach notification question",
            "Following your status page incident, we need written confirmation of what data "
            "was accessed for account {acct} so we can meet our own notification duties.",
       ),
        (
            "Disable a compromised integration key",
            "Our API key {key} may have been exposed in a public GitHub repo. Please revoke "
            "it immediately and issue a replacement.",
        ),
        (
            "Account takeover attempt via support",
            "Someone tried social-engineering your support team to change the email on our "
            "account. Please add a verbal password and flag our account for extra verification.",
        ),
        (
            "Need a SOC 2 report for our vendor review",
            "Our security team requires your latest SOC 2 Type II report and penetration test "
            "summary to complete vendor onboarding by {date}.",
        ),
        (
            "Urgent: ransomware note on shared workstation",
            "One of our users opened a attachment and now sees a ransomware note. They were "
            "logged into your product. Please audit sessions and force-logout all tokens.",
        ),
    ],
}

PLAN_WORDS = ["starter", "growth", "business", "enterprise", "pro"]
CURRENCIES = ["$", "€", "£"]


def money(lo: int = 9, hi: int = 950) -> str:
    return f"{RNG.choice(CURRENCIES)}{RNG.randint(lo, hi)}.{RNG.randint(0, 99):02d}"


def fill(template: str) -> str:
    return template.format(
        inv=f"INV-{RNG.randint(10000, 99999)}",
        plan=RNG.choice(PLAN_WORDS),
        amount=money(),
        amount2=money(),
        month=RNG.choice(
            ["January", "February", "March", "April", "May", "June",
             "July", "August", "September", "October", "November", "December"]
        ),
        acct=f"ACCT-{RNG.randint(1000, 9999)}",
        ver=f"{RNG.randint(100, 140)}.0.{RNG.randint(1, 9)}",
        dev=RNG.choice(["13", "14", "15", "16 Pro"]),
        hours=RNG.randint(4, 48),
        ticket=f"TCK-{RNG.randint(1, 9999):05d}",
        order=f"ORD-{RNG.randint(10000, 99999)}",
        date=f"2026-{RNG.randint(1, 12):02d}-{RNG.randint(1, 28):02d}",
        key=f"sk_live_{RNG.randint(10**12, 10**13 - 1)}",
    )


URGENT_MARKERS = [
    "urgently", "asap", "immediately", "legal", "breach", "outage", "down",
    "locked out", "production", "ransomware", "compromised", "48 hours", "escalate",
    "breaking", "blocked", "not working", "cannot", "crash", "data loss",
]
HIGH_MARKERS = ["please today", "this week", "important", "expedite", "priority", "still not"]
LOW_MARKERS = ["when you get a chance", "no rush", "question about", "just wondering", "fyi"]


def derive_priority(text: str, tier: str, category: str) -> str:
    t = text.lower()
    score = 0
    score += sum(2 for m in URGENT_MARKERS if m in t)
    score += sum(1 for m in HIGH_MARKERS if m in t)
    score -= sum(2 for m in LOW_MARKERS if m in t)
    score += {"enterprise": 2, "standard": 0, "free": -1}[tier]
    score += {"security": 2, "technical": 1, "refund": 0, "billing": 0,
              "account": 0, "shipping": 0}[category]
    if score >= 5:
        return "urgent"
    if score >= 2:
        return "high"
    if score >= 0:
        return "medium"
    return "low"


CATEGORY_TO_TEAM = {
    "billing": "finance",
    "refund": "finance",
    "technical": "engineering",
    "account": "support",
    "shipping": "logistics",
    "security": "security",
}

RESOLUTION_NOTES = {
    "billing": "Confirmed the duplicate charge with our payment provider and issued a reversal. "
               "Corrected invoice sent to the billing contact on file.",
    "technical": "Root cause was a stale cache node. After recycling the node and deploying the "
                 "patch, error rates returned to normal and monitoring confirms recovery.",
    "refund": "Refund approved under our refund policy and submitted to the original payment "
              "method. Expected to settle within 5-7 business days.",
    "account": "Verified the requester's identity against the account owner record, applied the "
               "requested change, and confirmed access with the customer.",
    "shipping": "Traced the parcel with the carrier, confirmed a routing error, and arranged an "
                "express reship at no additional cost to the customer.",
    "security": "Revoked all active sessions and API keys for the account, forced a credential "
                "rotation, and shared our incident timeline with the customer.",
}


def generate(n_per_category: int = 250) -> list[dict]:
    rows: list[dict] = []
    tiers = ["free", "standard", "enterprise"]
    for category in CATEGORIES:
        templates = TEMPLATES[category]
        for i in range(n_per_category):
            subject_t, desc_t = RNG.choice(templates)
            subject, description = fill(subject_t), fill(desc_t)

            if RNG.random() < 0.25:
                description += " " + RNG.choice(
                    ["Thanks in advance.", "This is blocking our team.",
                     "Please advise on next steps.", "Happy to provide more details.",
                     "Attaching screenshots for context."]
                )
            if RNG.random() < 0.15:
                subject = subject.upper() if RNG.random() < 0.5 else subject + "!!"

            tier = RNG.choice(tiers)
            text = f"{subject}\n{description}"
            priority = derive_priority(text, tier, category)
            team = CATEGORY_TO_TEAM[category]

            rows.append(
                {
                    "subject": subject,
                    "description": description,
                    "category": category,
                    "priority": priority,
                    "tier": tier,
                    "team": team,
                    "resolution_note": RESOLUTION_NOTES[category] if RNG.random() < 0.7 else "",
                    "resolved": RNG.random() < 0.8,
                }
            )
    RNG.shuffle(rows)
    return rows


def main() -> None:
    out = Path(__file__).parent / "data"
    out.mkdir(parents=True, exist_ok=True)
    rows = generate()
    path = out / "tickets.jsonl"
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    from collections import Counter

    print(f"Wrote {len(rows)} samples to {path}")
    print("categories:", dict(Counter(r["category"] for r in rows)))
    print("priorities:", dict(Counter(r["priority"] for r in rows)))
    print("tiers:", dict(Counter(r["tier"] for r in rows)))


if __name__ == "__main__":
    main()
