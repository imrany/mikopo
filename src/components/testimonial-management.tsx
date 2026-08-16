import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  LucideLoader,
  MessageSquareQuote,
  Star,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminDecideTestimonial,
  adminDeleteTestimonial,
  adminListTestimonials,
} from "@/lib/admin.functions";
import { useUrlStringState } from "@/lib/use-url-search-state";

type TestimonialRow = {
  id: string;
  user_id: string;
  author_name: string;
  role: string;
  content: string;
  rating: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export function TestimonialManagement() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListTestimonials);
  const decideFn = useServerFn(adminDecideTestimonial);
  const deleteFn = useServerFn(adminDeleteTestimonial);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: () => listFn(),
  });

  const testimonials = (data ?? []) as TestimonialRow[];

  const [deleteTestimonialId, setDeleteTestimonialId] = useUrlStringState("deleteTestimonialId");
  const deleteTarget = testimonials.find((t) => t.id === deleteTestimonialId) ?? null;
  const setDeleteTarget = (t: TestimonialRow | null) => setDeleteTestimonialId(t ? t.id : null);

  const [rejectTestimonialId, setRejectTestimonialId] = useUrlStringState("rejectTestimonialId");
  const rejectTarget = testimonials.find((t) => t.id === rejectTestimonialId) ?? null;
  const setRejectTarget = (t: TestimonialRow | null) => setRejectTestimonialId(t ? t.id : null);

  const decideMutation = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      decideFn({ data: input }),
    onSuccess: (_res, input) => {
      toast.success(
        input.status === "approved"
          ? "Testimonial approved & published to website homepage."
          : "Testimonial rejected.",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
      void queryClient.invalidateQueries({ queryKey: ["public-testimonials"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Testimonial deleted.");
      void queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
      void queryClient.invalidateQueries({ queryKey: ["public-testimonials"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="mt-6 border-border/70 shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareQuote className="size-4 text-primary" aria-hidden />
          Borrower testimonials & homepage reviews
        </CardTitle>
        <CardDescription>
          Review member feedback and approve entries to feature on the website homepage.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LucideLoader className="size-5 animate-spin text-primary" aria-label="Loading" />
          </div>
        ) : testimonials.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No member testimonials submitted yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testimonials.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>{item.author_name}</span>
                      <span className="text-xs text-muted-foreground">{item.role}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star key={i} className="size-3.5 fill-current" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">
                    <p className="line-clamp-2">{item.content}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "approved"
                          ? "default"
                          : item.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {item.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decideMutation.isPending}
                          onClick={() => decideMutation.mutate({ id: item.id, status: "approved" })}
                        >
                          <Check className="size-3.5 text-emerald-600" /> Approve
                        </Button>
                      )}
                      {item.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={decideMutation.isPending}
                          onClick={() => setRejectTarget(item)}
                        >
                          <X className="size-3.5 text-rose-600" /> Reject
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" /> Confirm Testimonial Deletion
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete this testimonial submission from{" "}
                <strong className="text-foreground">{deleteTarget?.author_name}</strong>? This
                action cannot be undone.
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
                Delete Testimonial
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(rejectTarget)}
          onOpenChange={(open) => !open && setRejectTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" /> Confirm Testimonial Rejection
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reject the testimonial from{" "}
                <strong className="text-foreground">{rejectTarget?.author_name}</strong>? It will
                not be published to the website homepage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={decideMutation.isPending}
                onClick={() => {
                  if (rejectTarget) {
                    decideMutation.mutate({ id: rejectTarget.id, status: "rejected" });
                    setRejectTarget(null);
                  }
                }}
              >
                {decideMutation.isPending ? (
                  <LucideLoader className="size-4 animate-spin mr-1" />
                ) : (
                  <X className="size-4 mr-1" />
                )}
                Reject Testimonial
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
