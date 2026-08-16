import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LucideLoader, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteUserGuarantor, listUserGuarantors, saveUserGuarantor } from "@/lib/loans.functions";
import { useUrlBooleanState, useUrlStringState } from "@/lib/use-url-search-state";

type GuarantorItem = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  id_number: string;
  relationship: string;
  occupation: string;
  address: string;
};

export function UserGuarantorsManager() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listUserGuarantors);
  const saveFn = useServerFn(saveUserGuarantor);
  const deleteFn = useServerFn(deleteUserGuarantor);

  const { data, isLoading } = useQuery({
    queryKey: ["my-guarantors"],
    queryFn: () => listFn(),
  });

  const guarantors = (data ?? []) as GuarantorItem[];

  const [deleteGuarantorId, setDeleteGuarantorId] = useUrlStringState("deleteGuarantorId");
  const deleteTarget = guarantors.find((g) => g.id === deleteGuarantorId) ?? null;
  const setDeleteTarget = (g: GuarantorItem | null) => setDeleteGuarantorId(g ? g.id : null);

  const [openModal, setOpenModal] = useUrlBooleanState("addGuarantor");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [relationship, setRelationship] = useState("");
  const [occupation, setOccupation] = useState("");
  const [address, setAddress] = useState("");

  const saveMutation = useMutation({
    mutationFn: (input: {
      firstName: string;
      lastName: string;
      phone: string;
      idNumber: string;
      relationship: string;
      occupation: string;
      address: string;
    }) => saveFn({ data: input }),
    onSuccess: () => {
      toast.success("Guarantor saved successfully.");
      void queryClient.invalidateQueries({ queryKey: ["my-guarantors"] });
      setOpenModal(false);
      setFirstName("");
      setLastName("");
      setPhone("");
      setIdNumber("");
      setRelationship("");
      setOccupation("");
      setAddress("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { guarantorId: id } }),
    onSuccess: () => {
      toast.success("Guarantor removed.");
      void queryClient.invalidateQueries({ queryKey: ["my-guarantors"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="border-border/70 shadow-soft">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" aria-hidden />
            My Registered Guarantors
          </CardTitle>
          <CardDescription>
            You must register reliable guarantors before requesting higher tier loans.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpenModal(true)}>
          <Plus className="size-4 mr-1.5" /> Add Guarantor
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LucideLoader className="size-5 animate-spin text-primary" aria-label="Loading" />
          </div>
        ) : guarantors.length === 0 ? (
          <div className="py-8 text-center">
            <ShieldCheck className="mx-auto size-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium">No guarantors added yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Adding guarantors speeds up loan approvals and raises your credit standing.
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setOpenModal(true)}>
              <Plus className="size-4 mr-1" /> Add Your First Guarantor
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>ID Number</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Occupation</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guarantors.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    {g.first_name} {g.last_name}
                  </TableCell>
                  <TableCell>{g.phone}</TableCell>
                  <TableCell>{g.id_number || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{g.relationship || "Contact"}</Badge>
                  </TableCell>
                  <TableCell>{g.occupation || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteTarget(g)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
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
                <Trash2 className="size-5" /> Remove Loan Guarantor?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove{" "}
                <strong className="text-foreground">
                  {deleteTarget?.first_name} {deleteTarget?.last_name}
                </strong>{" "}
                from your list of loan guarantors?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (deleteTarget) {
                    deleteMutation.mutate(deleteTarget.id);
                    setDeleteTarget(null);
                  }
                }}
              >
                {deleteMutation.isPending ? (
                  <LucideLoader className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 size-4" />
                )}
                Remove Guarantor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>

      <Sheet open={openModal} onOpenChange={setOpenModal}>
        <SheetContent className="sm:max-w-md overflow-y-auto flex flex-col justify-between">
          <div>
            <SheetHeader className="mb-4">
              <SheetTitle>Add loan guarantor</SheetTitle>
              <SheetDescription>
                Enter the full contact details of your guarantor for loan security verification.
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="g-first">First name *</Label>
                  <Input
                    id="g-first"
                    placeholder="e.g. John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-last">Last name *</Label>
                  <Input
                    id="g-last"
                    placeholder="e.g. Kamau"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="g-phone">M-Pesa / Phone *</Label>
                  <Input
                    id="g-phone"
                    placeholder="e.g. 0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-id">National ID number *</Label>
                  <Input
                    id="g-id"
                    placeholder="e.g. 29384756"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="g-rel">Relationship</Label>
                  <Input
                    id="g-rel"
                    placeholder="e.g. Relative, Colleague, Friend"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-occ">Occupation</Label>
                  <Input
                    id="g-occ"
                    placeholder="e.g. Businessman, Accountant"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="g-addr">Residential / Business Address</Label>
                <Input
                  id="g-addr"
                  placeholder="e.g. Nairobi, Westlands"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6 flex-row gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              <X className="size-4 mr-1" /> Cancel
            </Button>
            <Button
              disabled={
                saveMutation.isPending ||
                !firstName.trim() ||
                !lastName.trim() ||
                !phone.trim() ||
                !idNumber.trim()
              }
              onClick={() =>
                saveMutation.mutate({
                  firstName,
                  lastName,
                  phone,
                  idNumber,
                  relationship,
                  occupation,
                  address,
                })
              }
            >
              {saveMutation.isPending ? (
                <LucideLoader className="animate-spin size-4 mr-1" />
              ) : null}
              Save Guarantor
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
