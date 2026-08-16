import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LucideLoader, MessageSquareQuote, Plus, Star, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteTestimonial, listMyTestimonials, submitTestimonial } from "@/lib/loans.functions";
import { fireCelebrationConfetti } from "@/lib/confetti";
import { useAppConfig } from "@/lib/config-context";
import { useUrlStringState } from "@/lib/use-url-search-state";

type TestimonialItem = {
  id: string;
  author_name: string;
  role: string;
  content: string;
  rating: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export function UserTestimonialForm() {
  const { businessName } = useAppConfig();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMyTestimonials);
  const submitFn = useServerFn(submitTestimonial);
  const deleteFn = useServerFn(deleteTestimonial);

  const { data, isLoading } = useQuery({
    queryKey: ["my-testimonials"],
    queryFn: () => listFn(),
  });

  const testimonials = (data ?? []) as TestimonialItem[];

  const [deleteMyTestimonialId, setDeleteMyTestimonialId] =
    useUrlStringState("deleteMyTestimonialId");
  const deleteTarget = testimonials.find((t) => t.id === deleteMyTestimonialId) ?? null;
  const setDeleteTarget = (t: TestimonialItem | null) => setDeleteMyTestimonialId(t ? t.id : null);

  const [rating, setRating] = useState(5);
  const [role, setRole] = useState("Small Business Owner");
  const [content, setContent] = useState("");

  const submitMutation = useMutation({
    mutationFn: (input: { content: string; rating: number; role?: string }) =>
      submitFn({ data: input }),
    onSuccess: () => {
      fireCelebrationConfetti();
      void queryClient.invalidateQueries({ queryKey: ["my-testimonials"] });
      setContent("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-testimonials"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="border-border/70 shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareQuote className="size-4 text-primary" aria-hidden />
          Share Your Experience
        </CardTitle>
        <CardDescription>
          Submit a testimonial about your {businessName} borrowing experience to be featured on our
          homepage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (content.trim()) {
              submitMutation.mutate({ content, rating, role });
            }
          }}
          className="space-y-4 rounded-lg border p-4 bg-muted/20"
        >
          <div className="space-y-2">
            <Label>Overall Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none"
                >
                  <Star
                    className={`size-6 ${
                      star <= rating ? "fill-gold text-gold" : "fill-muted text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-role">Your Occupation or Business Title</Label>
            <Input
              id="t-role"
              placeholder="e.g. Retail Trader, Nairobi"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-content">Your Review / Story</Label>
            <Textarea
              id="t-content"
              placeholder={`How ${businessName} helped grow your business or meet urgent financial needs...`}
              rows={3}
              minLength={10}
              maxLength={500}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={submitMutation.isPending || !content.trim()}
            className="w-full sm:w-auto"
          >
            {submitMutation.isPending ? <LucideLoader className="animate-spin" /> : <Plus />}
            Submit Review
          </Button>
        </form>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <LucideLoader className="size-4 animate-spin text-primary" />
          </div>
        ) : testimonials.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your Previously Submitted Reviews
            </h4>
            <div className="space-y-2">
              {testimonials.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between rounded-lg border p-3 text-sm bg-background"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex text-gold">
                        {Array.from({ length: item.rating }).map((_, i) => (
                          <Star key={i} className="size-3.5 fill-current" />
                        ))}
                      </div>
                      <Badge
                        variant={
                          item.status === "approved"
                            ? "default"
                            : item.status === "rejected"
                              ? "destructive"
                              : item.status.includes("pending")
                                ? "gold"
                                : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {item.status === "approved"
                          ? "Approved & Live"
                          : item.status === "rejected"
                            ? "Rejected"
                            : "Pending Review"}
                      </Badge>
                    </div>
                    <p className="text-foreground">{item.content}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" /> Delete Review Submission?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this feedback review? It will be removed from your
                account history and website review submissions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (deleteTarget) {
                    deleteMutation.mutate(deleteTarget.id);
                    setDeleteTarget(null);
                  }
                }}
              >
                {deleteMutation.isPending ? (
                  <LucideLoader className="size-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="size-4 mr-1" />
                )}
                Delete Review
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
