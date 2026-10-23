from __future__ import annotations

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Team, User
from ai.models import MLPrediction
from ai.services import triage_ticket
from tickets.models import Category, SLAPolicy, Ticket

RNG = random.Random(7)

TEAMS = [
    ("Support", "support", "Front-line customer support", ["account", "general"]),
    ("Engineering", "engineering", "Product and platform engineering", ["technical"]),
    ("Finance", "finance", "Billing, invoices and refunds", ["billing", "refund"]),
    ("Logistics", "logistics", "Shipping and fulfilment", ["shipping"]),
    ("Security", "security", "Security incidents and compliance", ["security"]),
]

CATEGORIES = [
    ("Billing", "billing", "Invoices, charges and payment questions", "finance", "receipt"),
    ("Technical", "technical", "Product bugs, API and integration issues", "engineering", "bug"),
    ("Refund", "refund", "Refund and cancellation requests", "finance", "undo"),
    ("Account", "account", "Access, users and account settings", "support", "user"),
    ("Shipping", "shipping", "Delivery, lost parcels and fulfilment", "logistics", "truck"),
    ("Security", "security", "Suspicious activity and vulnerability reports", "security", "shield"),
]

SLA_MINUTES = {
    "LOW": (480, 5760),
    "MEDIUM": (240, 2880),
    "HIGH": (60, 720),
    "URGENT": (15, 240),
}

USERS = [
    ("admin", "admin@smartdesk.dev", "Ava", "Admin", "ADMIN", None, "enterprise", []),
    ("maya", "maya@smartdesk.dev", "Maya", "Okafor", "TEAM_LEAD", "engineering", "standard", ["technical"]),
    ("sam", "sam@smartdesk.dev", "Sam", "Rivera", "TEAM_LEAD", "finance", "standard", ["billing", "refund"]),
    ("leo", "leo@smartdesk.dev", "Leo", "Anders", "TEAM_LEAD", "support", "standard", ["account"]),
    ("priya", "priya@smartdesk.dev", "Priya", "Nair", "AGENT", "engineering", "standard", ["technical"]),
    ("jonas", "jonas@smartdesk.dev", "Jonas", "Berg", "AGENT", "engineering", "standard", ["technical"]),
    ("nina", "nina@smartdesk.dev", "Nina", "Costa", "AGENT", "finance", "standard", ["billing", "refund"]),
    ("omar", "omar@smartdesk.dev", "Omar", "Haddad", "AGENT", "support", "standard", ["account"]),
    ("lena", "lena@smartdesk.dev", "Lena", "Fischer", "AGENT", "logistics", "standard", ["shipping"]),
    ("yuki", "yuki@smartdesk.dev", "Yuki", "Tanaka", "AGENT", "security", "standard", ["security"]),
    ("acme", "ops@acme-corp.com", "Dana", "Whitfield", "CUSTOMER", None, "enterprise", []),
    ("globex", "help@globex.io", "Raj", "Mehta", "CUSTOMER", None, "standard", []),
    ("initech", "it@initech.dev", "Peter", "Gibbons", "CUSTOMER", None, "free", []),
    ("umbrella", "support@umbrella.co", "Jill", "Valentine", "CUSTOMER", None, "enterprise", []),
]

TICKET_SEEDS = [
    ("API returning 500 errors since this morning",
     "All calls to /api/v2/orders are returning HTTP 500 starting around 09:00 UTC. "
     "This is breaking our checkout flow in production. Stack trace attached. Urgent — we "
     "are losing orders every minute this stays down.", "technical"),
    ("Duplicate charge on invoice INV-48219",
     "I was charged twice for my growth plan on invoice INV-48219. The amount $249.00 was "
     "taken from my card on the same day twice. Please reverse the extra charge ASAP.", "billing"),
    ("Order ORD-55102 has not arrived",
     "My order ORD-55102 was supposed to arrive last Friday but tracking has not updated "
     "in 5 days. Can you please check where it is?", "shipping"),
    ("Cannot reset my password",
     "The password reset email never arrives. I have checked spam and tried three different "
     "addresses. I am locked out of account ACCT-4821 and need access today.", "account"),
    ("Suspicious login on our account",
     "We saw logins on account ACCT-1042 from an unfamiliar IP in another country at 3am. "
     "We did not authorise this. Please lock the account and help us rotate credentials "
     "immediately. This looks like an account takeover.", "security"),
    ("Refund request for outage last week",
     "Last week's outage took the service down for 6 hours during our peak time. Per your "
     "SLA we are owed a refund. Please process it this week.", "refund"),
    ("Webhook deliveries delayed 20+ minutes",
     "Our webhooks are arriving 20-30 minutes late since yesterday. Payloads look fine, "
     "just late. This is causing sync failures with our CRM. Please escalate to engineering.",
     "technical"),
    ("Change the account owner email",
     "Our previous owner has left the company. Please transfer ownership of account ACCT-7781 "
     "to my email so we can manage billing and users.", "account"),
    ("Package marked delivered but not here",
     "Tracking says my package was delivered yesterday, but nothing arrived at our reception. "
     "Please investigate with the carrier and arrange a reship.", "shipping"),
    ("Need a VAT invoice for October",
     "We need a proper VAT invoice for October with our company VAT number included. The "
     "current PDF does not show the tax breakdown we need for accounting.", "billing"),
    ("Report a vulnerability in your API",
     "I discovered an IDOR issue in the /api/v2/invoices endpoint that exposes other tenants' "
     "invoices. I would like to report this responsibly. Details attached.", "security"),
    ("Cancel and refund remaining balance",
     "We are cancelling our subscription. Please refund the unused portion of our annual plan "
     "($1,840.00 remaining) within 14 days as required. No rush, just process it properly.",
     "refund"),
    ("Dashboard loads with a blank screen",
     "After logging in, the dashboard shows a blank white screen. Browser console shows a "
     "React error about a failed chunk load. Hard refresh does not help.", "technical"),
    ("Locked out after too many login attempts",
     "My account got locked after failed login attempts. I need it unlocked ASAP and would "
     "like to set up SSO so this does not happen again.", "account"),
    ("Damaged item on delivery",
     "Order ORD-77310 arrived with the outer box crushed and the product scratched. Photos "
     "attached. I would like a replacement or refund urgently.", "shipping"),
    ("Two-factor codes not being delivered",
     "SMS two-factor codes are not arriving for any of our users today. We have confirmed "
     "the phone numbers are correct. Everyone is locked out of production. Urgent.", "technical"),
    ("Add a new admin user to our workspace",
     "Please add jane.doe@example.com as an administrator on workspace ACCT-2201. She is our "
     "new IT lead and needs full access rights.", "account"),
    ("Charged after free trial ended",
     "I was charged $99.00 the day after the free trial ended. I cancelled the trial on the "
     "last day, but the charge still went through. Please refund it.", "refund"),
    ("Need to change the delivery address",
     "Order ORD-90120 has not shipped yet. Please change the delivery address to our new "
     "warehouse before it goes out. Thanks!", "shipping"),
    ("Integration with Salesforce stopped syncing",
     "Our Salesforce integration last synced 36 hours ago and shows a connection error. "
     "Nothing changed on our side. Please look into this.", "technical"),
    ("Suspected phishing email using your brand",
     "We received an email that looks like it is from your team asking us to re-enter billing "
     "details. Header analysis attached. Please confirm whether it is legitimate.", "security"),
    ("Legal action if refund is not processed",
     "Three requests for a $450.00 refund have been ignored. If I do not get a response within "
     "48 hours I will be forced to involve my bank and seek legal advice.", "refund"),
    ("Question about enterprise plan pricing",
     "Could you clarify what is included in the enterprise plan? Specifically whether API "
     "access and priority support are part of the $899 monthly price?", "billing"),
    ("Merge two duplicate accounts",
     "We have two accounts under the same company email domain. Can you merge them so all our "
     "ticket history is in one place? No rush.", "account"),
    ("Express shipping upgrade needed",
     "We need order ORD-44120 by next Tuesday for a client launch. Can you upgrade it to "
     "express shipping and tell us the extra cost?", "shipping"),
    ("Disable a compromised integration key",
     "Our API key sk_live_918273645501 may have been exposed in a public GitHub repo. Please "
     "revoke it immediately and issue a replacement.", "security"),
    ("Slow page loads on the orders screen",
     "The orders screen takes over 15 seconds to load since we crossed 10k records. It used "
     "to be instant. This is slowing down our support team.", "technical"),
    ("Refund not received after 30 days",
     "You confirmed a refund on ticket TCK-00087 over 30 days ago for $320.00. I still have "
     "not seen the money. This is unacceptable, please escalate immediately.", "refund"),
    ("Annual plan renewal receipt needed",
     "Our annual plan renewed on 1 October. Please send the receipt showing the $2,400.00 "
     "charge so I can expense it. Thanks!", "billing"),
    ("Deactivate a former employee",
     "Please deactivate the user mark.smith@example.com immediately. He left the company "
     "yesterday and should no longer have access to our data.", "account"),
]

STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]
STATUS_WEIGHTS = [0.18, 0.16, 0.22, 0.10, 0.20, 0.14]

COMMENTS = [
    ("Thanks for the detail — I'm looking into this now and will update you shortly.", False),
    ("Confirmed with the customer; awaiting a screenshot from their side.", True),
    ("Reproduced on staging. Linking to the internal incident ticket.", True),
    ("Customer confirmed the fix works. Closing unless they reply again.", False),
]


class Command(BaseCommand):
    help = "Seed demo data (teams, users, tickets) and run AI triage on each ticket."

    def add_arguments(self, parser):
        parser.add_argument("--tickets", type=int, default=45, help="How many tickets to create.")
        parser.add_argument("--wipe", action="store_true", help="Delete existing tickets first.")

    def handle(self, *args, **options):
        if options["wipe"]:
            Ticket.objects.all().delete()
            MLPrediction.objects.all().delete()
            self.stdout.write("Wiped existing tickets.")

        teams = {}
        for name, slug, desc, expertise in TEAMS:
            teams[slug], _ = Team.objects.get_or_create(
                slug=slug, defaults={"name": name, "description": desc, "expertise": expertise}
            )

        categories = {}
        for name, slug, desc, team_slug, icon in CATEGORIES:
            categories[slug], _ = Category.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "description": desc,
                    "default_team": teams[team_slug],
                    "icon": icon,
                },
            )

        for cat in categories.values():
            for priority, (resp, res) in SLA_MINUTES.items():
                SLAPolicy.objects.get_or_create(
                    category=cat, priority=priority,
                    defaults={"response_minutes": resp, "resolution_minutes": res},
                )

        users = {}
        for username, email, first, last, role, team_slug, tier, skills in USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email, "first_name": first, "last_name": last,
                    "role": role, "tier": tier, "skills": skills,
                    "team": teams.get(team_slug) if team_slug else None,
                },
            )
            if created:
                user.set_password("smartdesk123")
                user.save()
            users[username] = user

        staff_agents = [u for u in users.values() if u.role in ("AGENT", "TEAM_LEAD")]
        customers = [u for u in users.values() if u.role == "CUSTOMER"]

        n = options["tickets"]
        now = timezone.now()
        created_count = 0

        for i in range(n):
            title, desc, cat_slug = TICKET_SEEDS[i % len(TICKET_SEEDS)]
            category = categories[cat_slug]
            requester = RNG.choice(customers)
            status = RNG.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
            created_at = now - timedelta(hours=RNG.randint(2, 24 * 21), minutes=RNG.randint(0, 59))

            ticket = Ticket(
                title=title,
                description=desc,
                requester=requester,
                category=category,
                team=category.default_team,
                status=status,
                priority=RNG.choice(["LOW", "MEDIUM", "MEDIUM", "HIGH"]),
            )
            ticket.save()
            Ticket.objects.filter(pk=ticket.pk).update(created_at=created_at)
            ticket.refresh_from_db()

            if status in ("IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"):
                assignee = RNG.choice(
                    [a for a in staff_agents if a.team_id == category.default_team_id] or staff_agents
                )
                ticket.assignee = assignee
                ticket.first_response_at = created_at + timedelta(minutes=RNG.randint(10, 300))
                ticket.save()

            if status in ("RESOLVED", "CLOSED"):
                ticket.resolved_at = created_at + timedelta(hours=RNG.randint(2, 72))
                ticket.save()

            ticket.apply_sla()
            ticket.save()

            result = triage_ticket(ticket, force=False)
            if result.get("status") == "ok":
                created_count += 1

            if RNG.random() < 0.45:
                body, internal = RNG.choice(COMMENTS)
                ticket.comments.create(author=RNG.choice(staff_agents), body=body,
                                       is_internal=internal)

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {n} tickets ({created_count} triaged by AI). "
            f"Demo logins: admin/smartdesk123, maya/smartdesk123, acme/smartdesk123"
        ))
