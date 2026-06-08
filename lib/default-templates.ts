export const DEFAULT_EMAIL_TEMPLATES = {
  INVITATION: {
    type: "INVITATION",
    name: "Standard Invitation",
    subject: "You're Invited to {{eventName}}",
    senderName: "Event Team",
    replyTo: "noreply@events.com",
    plainBody: `Dear {{salutation}} {{guestName}},

We are delighted to invite you to {{eventName}}.

Event Details:
Date: {{eventDate}}
Time: {{eventTime}}
Venue: {{venue}}

We would appreciate it if you could confirm your attendance by {{rsvpDeadline}}.

Please RSVP using the following link:
{{acceptUrl}}

If you are unable to attend, please let us know:
{{declineUrl}}

If you have any questions or dietary restrictions, please feel free to reach out to us.

Best regards,
Event Team`,
  },
  ACCEPTANCE_CONFIRMATION: {
    type: "ACCEPTANCE_CONFIRMATION",
    name: "Acceptance Confirmation",
    subject: "Your RSVP Confirmed for {{eventName}}",
    senderName: "Event Team",
    replyTo: "noreply@events.com",
    plainBody: `Dear {{salutation}} {{guestName}},

Thank you for confirming your attendance at {{eventName}}.

We look forward to seeing you on:
Date: {{eventDate}}
Time: {{eventTime}}
Venue: {{venue}}

Parking and directions will be provided closer to the event date.

If your plans change or you have any questions, please don't hesitate to contact us.

Best regards,
Event Team`,
  },
  DECLINE_ACKNOWLEDGMENT: {
    type: "DECLINE_ACKNOWLEDGMENT",
    name: "Decline Acknowledgment",
    subject: "We'll Miss You at {{eventName}}",
    senderName: "Event Team",
    replyTo: "noreply@events.com",
    plainBody: `Dear {{salutation}} {{guestName}},

We appreciate you letting us know that you won't be able to attend {{eventName}}.

If your circumstances change and you become available, please don't hesitate to reach out to us.

We hope to have the opportunity to see you at future events.

Best regards,
Event Team`,
  },
  REMINDER: {
    type: "REMINDER",
    name: "RSVP Reminder",
    subject: "Reminder: Please RSVP for {{eventName}}",
    senderName: "Event Team",
    replyTo: "noreply@events.com",
    plainBody: `Dear {{salutation}} {{guestName}},

We hope you received our invitation to {{eventName}}.

This is a friendly reminder that we would love to have you join us. Your RSVP is important for our planning.

Event Details:
Date: {{eventDate}}
Time: {{eventTime}}
Venue: {{venue}}
RSVP Deadline: {{rsvpDeadline}}

Please confirm your attendance here:
{{acceptUrl}}

Or let us know if you cannot make it:
{{declineUrl}}

Thank you!

Best regards,
Event Team`,
  },
  THANK_YOU: {
    type: "THANK_YOU",
    name: "Thank You",
    subject: "Thank You for Attending {{eventName}}",
    senderName: "Event Team",
    replyTo: "noreply@events.com",
    plainBody: `Dear {{salutation}} {{guestName}},

Thank you for attending {{eventName}}!

We truly appreciate your presence and the contributions you made to make this event special. Your participation meant a lot to us.

We would love to hear your thoughts about the event. Your feedback helps us improve and deliver better experiences in the future.

Please share your feedback (1-5 stars and optional comments):
{{feedbackUrl}}

We look forward to seeing you again at our upcoming events.

Best regards,
Event Team`,
  },
};

export const TEMPLATE_PLACEHOLDERS = [
  {
    variable: "{{guestName}}",
    description: "Guest's full name",
  },
  {
    variable: "{{salutation}}",
    description: "Guest's salutation (Mr., Ms., Dr., etc.)",
  },
  {
    variable: "{{eventName}}",
    description: "Name of the event",
  },
  {
    variable: "{{eventDate}}",
    description: "Date of the event",
  },
  {
    variable: "{{eventTime}}",
    description: "Time of the event",
  },
  {
    variable: "{{venue}}",
    description: "Event venue/location",
  },
  {
    variable: "{{rsvpDeadline}}",
    description: "RSVP deadline",
  },
  {
    variable: "{{acceptUrl}}",
    description: "Link for guest to accept invitation",
  },
  {
    variable: "{{declineUrl}}",
    description: "Link for guest to decline invitation",
  },
  {
    variable: "{{feedbackUrl}}",
    description: "Link for guest to submit feedback (thank you emails only)",
  },
];
