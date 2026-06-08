"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FeedbackFormProps {
  token: string;
  eventName: string;
  guestName: string;
  guestSalutation?: string;
  initialRating: number;
  initialComment: string | null;
}

export function FeedbackForm({
  token,
  eventName,
  guestName,
  guestSalutation,
  initialRating,
  initialComment,
}: FeedbackFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(initialRating || 0);
  const [comment, setComment] = useState<string>(initialComment || "");
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const displayName = guestSalutation ? `${guestSalutation} ${guestName}` : guestName;

  async function handleSubmit() {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          comment: comment.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to submit feedback");
      }

      toast.success("Thank you for your feedback!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Share Your Feedback</CardTitle>
        <CardDescription>
          Thank you for attending {eventName}!
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Greeting */}
        <p className="text-sm text-muted-foreground">
          Hi {displayName}, we'd love to hear your thoughts about the event.
        </p>

        {/* Star Rating */}
        <div className="space-y-3">
          <label className="text-sm font-medium">How would you rate this event? *</label>
          <div className="flex gap-3 justify-center py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                <span
                  className={`text-5xl transition-colors ${
                    star <= (hoveredRating || rating)
                      ? "text-yellow-400"
                      : "text-gray-300"
                  }`}
                >
                  ★
                </span>
              </button>
            ))}
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {rating > 0 ? (
                <>
                  <span className="text-lg font-semibold text-foreground">{rating}</span>
                  <span> out of 5 stars</span>
                </>
              ) : (
                <span>Click to rate</span>
              )}
            </p>
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-3">
          <label htmlFor="comment" className="text-sm font-medium">
            Comments & Suggestions <span className="text-muted-foreground">(Optional)</span>
          </label>
          <Textarea
            id="comment"
            placeholder="Share your thoughts, suggestions, or any feedback to help us improve future events..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-32 resize-none"
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {comment.length}/1000 characters
          </p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={loading || rating === 0}
          className="w-full"
          size="lg"
        >
          <Send className="h-4 w-4 mr-2" />
          {loading ? "Submitting..." : "Submit Feedback"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Thank you for helping us improve! Your feedback is valuable to us.
        </p>
      </CardContent>
    </Card>
  );
}
