"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackForm } from "@/components/feedback-form";
import { Card } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface Feedback {
  id: string;
  token: string;
  rating: number;
  comment: string | null;
  submittedAt: string | null;
  event: { id: string; name: string };
  guest: { id: string; fullName: string; email: string; salutation: string | null };
}

export default function FeedbackPage({ params }: PageProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    async function loadFeedback() {
      try {
        const { token: paramToken } = await params;
        setToken(paramToken);

        console.log(`[FeedbackPage] Loading feedback for token: ${paramToken}`);

        const res = await fetch(`/api/feedback/${paramToken}`);

        if (!res.ok) {
          console.error(`[FeedbackPage] API error: ${res.status}`);
          setError("Invalid or expired feedback link");
          setLoading(false);
          return;
        }

        const contentType = res.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          console.error(`[FeedbackPage] Wrong content type: ${contentType}`);
          setError("Server error - invalid response format");
          setLoading(false);
          return;
        }

        const data = await res.json();

        if (!data.success || !data.feedback) {
          console.error(`[FeedbackPage] No feedback in response`, data);
          setError("Feedback not found");
          setLoading(false);
          return;
        }

        setFeedback(data.feedback);
        setLoading(false);
      } catch (err) {
        console.error(`[FeedbackPage] Error loading feedback:`, err);
        setError(err instanceof Error ? err.message : "Failed to load feedback");
        setLoading(false);
      }
    }

    loadFeedback();
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">Loading feedback form...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact the event organizer.
          </p>
        </Card>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <p className="text-gray-600">Feedback not found</p>
        </Card>
      </div>
    );
  }

  // Check if already submitted
  if (feedback.submittedAt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-4">
            We've already received your feedback for {feedback.event.name}. Thank you for taking the time to share your thoughts with us!
          </p>
          <p className="text-sm text-gray-500">
            Your rating: <span className="font-semibold">{feedback.rating}/5 ⭐</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 py-12">
      <FeedbackForm
        token={token}
        eventName={feedback.event.name}
        guestName={feedback.guest.fullName}
        guestSalutation={feedback.guest.salutation}
        initialRating={feedback.rating}
        initialComment={feedback.comment}
      />
    </div>
  );
}
