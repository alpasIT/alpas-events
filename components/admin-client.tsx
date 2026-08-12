"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Key, RotateCcw, Eye, EyeOff } from "lucide-react";
import { adminUserSchema, newPasswordSchema, type AdminUserInput, type NewPasswordInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatTimeAgo } from "@/lib/utils";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  lastLogin: string | null;
  createdAt: string;
}

interface AdminClientProps {
  admins: AdminUser[];
  currentUserEmail: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  EVENT_COORDINATOR: "bg-blue-100 text-blue-800",
  VIEWER: "bg-gray-100 text-gray-800",
  STAFF: "bg-green-100 text-green-800",
};

export function AdminClient({ admins, currentUserEmail }: AdminClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AdminUserInput>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: { role: "EVENT_COORDINATOR" },
  });

  const role = watch("role");

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    reset: resetResetForm,
    formState: { errors: resetErrors },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
  });

  async function onSubmit(data: AdminUserInput) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create admin");
      }

      toast.success("Admin user created");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(adminId: string, adminEmail: string) {
    if (adminEmail === currentUserEmail) {
      toast.error("You cannot delete your own account");
      return;
    }
    if (!confirm(`Delete admin ${adminEmail}?`)) return;
    const res = await fetch(`/api/admin/${adminId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Admin deleted");
      router.refresh();
    } else {
      toast.error("Failed to delete admin");
    }
  }

  async function onResetSubmit(data: NewPasswordInput) {
    if (!resetTarget) return;

    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: data.password, adminEmail: resetTarget.email }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to reset password");
      }

      toast.success(`Password reset for ${resetTarget.email}`);
      setResetTarget(null);
      resetResetForm();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  }


  return (
    <div className="space-y-4">
      <Button onClick={() => { reset(); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" />
        Add Admin User
      </Button>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium">{admin.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{admin.email}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[admin.role] ?? "bg-gray-100 text-gray-800"}`}>
                    {admin.role.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {admin.lastLogin ? formatTimeAgo(admin.lastLogin) : "Never"}
                </TableCell>
                <TableCell className="flex gap-1">
                  {admin.email !== currentUserEmail && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Reset password"
                        onClick={() => setResetTarget({ id: admin.id, email: admin.email })}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(admin.id, admin.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Admin User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input {...register("name")} placeholder="Juan Dela Cruz" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Email *</Label>
              <Input {...register("email")} type="email" placeholder="admin@example.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Password *</Label>
              <Input {...register("password")} type="password" placeholder="Min 8 characters" />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setValue("role", v as AdminUserInput["role"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="EVENT_COORDINATOR">Event Coordinator</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Admin"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetTarget}
        onOpenChange={(v) => {
          if (!v) {
            setResetTarget(null);
            resetResetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password for {resetTarget?.email}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetSubmit(onResetSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>New password *</Label>
              <div className="relative">
                <Input
                  {...registerReset("password")}
                  type={showResetPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  tabIndex={-1}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {resetErrors.password && (
                <p className="text-xs text-destructive">{resetErrors.password.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Confirm password *</Label>
              <Input
                {...registerReset("confirmPassword")}
                type={showResetPassword ? "text" : "password"}
                placeholder="Min 8 characters"
              />
              {resetErrors.confirmPassword && (
                <p className="text-xs text-destructive">{resetErrors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
