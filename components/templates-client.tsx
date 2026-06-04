"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Star, ImagePlus, X } from "lucide-react";
import { emailTemplateSchema, type EmailTemplateInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  htmlBody: string | null;
  plainBody: string;
  imageUrls: string[];
  senderName: string;
  replyTo: string;
  isDefault: boolean;
}

interface TemplatesClientProps {
  eventId: string;
  initialTemplates: EmailTemplate[];
}

const TEMPLATE_TYPES = [
  "INVITATION",
  "ACCEPTANCE_CONFIRMATION",
  "DECLINE_ACKNOWLEDGMENT",
  "REMINDER",
  "THANK_YOU",
];

const PLACEHOLDERS = [
  "{{guestName}}", "{{salutation}}", "{{eventName}}", "{{eventDate}}",
  "{{eventTime}}", "{{venue}}", "{{rsvpDeadline}}", "{{acceptUrl}}", "{{declineUrl}}",
];

export function TemplatesClient({ eventId, initialTemplates }: TemplatesClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editTemplate;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EmailTemplateInput>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: { isDefault: false, imageUrls: [] },
  });

  const type = watch("type");

  function openCreate() {
    reset({ isDefault: false, imageUrls: [] });
    setImageUrls([]);
    setEditTemplate(null);
    setOpen(true);
  }

  function openEdit(template: EmailTemplate) {
    reset({
      name: template.name,
      type: template.type as EmailTemplateInput["type"],
      subject: template.subject,
      plainBody: template.plainBody,
      imageUrls: template.imageUrls,
      senderName: template.senderName,
      replyTo: template.replyTo,
      isDefault: template.isDefault,
    });
    setImageUrls(template.imageUrls ?? []);
    setEditTemplate(template);
    setOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    const uploaded: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", eventId);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        toast.error(`Failed to upload ${file.name}: ${json.error ?? "Unknown error"}`);
        continue;
      }

      uploaded.push(json.url);
    }

    if (uploaded.length) {
      const next = [...imageUrls, ...uploaded];
      setImageUrls(next);
      setValue("imageUrls", next);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(url: string) {
    const next = imageUrls.filter((u) => u !== url);
    setImageUrls(next);
    setValue("imageUrls", next);
  }

  async function onSubmit(data: EmailTemplateInput) {
    setLoading(true);
    try {
      const payload = { ...data, imageUrls };
      const url = isEdit
        ? `/api/events/${eventId}/templates/${editTemplate!.id}`
        : `/api/events/${eventId}/templates`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save template");
      }

      toast.success(isEdit ? "Template updated" : "Template created");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefault(templateId: string) {
    setSettingDefault(templateId);
    try {
      const res = await fetch(`/api/events/${eventId}/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("Default template updated");
      router.refresh();
    } catch {
      toast.error("Failed to set default");
    } finally {
      setSettingDefault(null);
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/events/${eventId}/templates/${templateId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Template deleted");
      router.refresh();
    } else {
      toast.error("Failed to delete template");
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={openCreate}>
        <Plus className="h-4 w-4 mr-2" />
        New Template
      </Button>

      {initialTemplates.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
          <p className="text-sm">No email templates yet. Create one to customize invitation emails.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {initialTemplates.map((template) => (
            <Card key={template.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-0.5" title={template.isDefault ? "Default template" : "Set as default"}>
                    <input
                      type="checkbox"
                      checked={template.isDefault}
                      disabled={template.isDefault || settingDefault === template.id}
                      onChange={() => handleSetDefault(template.id)}
                      className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-default"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{template.name}</h3>
                      {template.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{template.type.replace(/_/g, " ")}</Badge>
                      {template.imageUrls?.length > 0 && (
                        <Badge variant="outline" className="text-xs">{template.imageUrls.length} image{template.imageUrls.length > 1 ? "s" : ""}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{template.subject}</p>
                    <p className="text-xs text-muted-foreground">From: {template.senderName}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(template)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Template Name *</Label>
                <Input {...register("name")} placeholder="VIP Invitation" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Type *</Label>
                <Select value={type} onValueChange={(v) => setValue("type", v as EmailTemplateInput["type"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Subject *</Label>
              <Input {...register("subject")} placeholder="You're invited to {{eventName}}" />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Sender Name *</Label>
                <Input {...register("senderName")} placeholder="Event Team" />
                {errors.senderName && <p className="text-xs text-destructive">{errors.senderName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Reply-To *</Label>
                <Input {...register("replyTo")} type="email" placeholder="rsvp@example.com" />
                {errors.replyTo && <p className="text-xs text-destructive">{errors.replyTo.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Email Body *</Label>
              <div className="text-xs text-muted-foreground mb-1">
                Available placeholders: {PLACEHOLDERS.join(", ")}
              </div>
              <Textarea
                {...register("plainBody")}
                rows={8}
                placeholder={`Dear {{salutation}} {{guestName}},\n\nWe would be honored by your presence at {{eventName}}.\n\nDate: {{eventDate}}\nTime: {{eventTime}}\nVenue: {{venue}}`}
              />
              {errors.plainBody && <p className="text-xs text-destructive">{errors.plainBody.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Images</Label>
              <p className="text-xs text-muted-foreground">Images will appear above the email body. Accepted: JPG, PNG, GIF, WebP.</p>

              {imageUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {imageUrls.map((url) => (
                    <div key={url} className="relative group rounded overflow-hidden border aspect-video bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Images"}
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
