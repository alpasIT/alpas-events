"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { DEFAULT_EMAIL_TEMPLATES, TEMPLATE_PLACEHOLDERS } from "@/lib/default-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DefaultTemplatesClientProps {
  eventId: string;
}

interface EditingTemplate {
  name: string;
  subject: string;
  plainBody: string;
  senderName: string;
  replyTo: string;
}

type TemplateType = keyof typeof DEFAULT_EMAIL_TEMPLATES;

export function DefaultTemplatesClient({ eventId }: DefaultTemplatesClientProps) {
  const router = useRouter();
  const [expandedType, setExpandedType] = useState<TemplateType>("INVITATION");
  const [editingTemplates, setEditingTemplates] = useState<
    Record<TemplateType, EditingTemplate>
  >(() => {
    const initial: Record<TemplateType, EditingTemplate> = {} as any;
    Object.keys(DEFAULT_EMAIL_TEMPLATES).forEach((type) => {
      const template = DEFAULT_EMAIL_TEMPLATES[type as TemplateType];
      initial[type as TemplateType] = {
        name: template.name,
        subject: template.subject,
        plainBody: template.plainBody,
        senderName: template.senderName,
        replyTo: template.replyTo,
      };
    });
    return initial;
  });
  const [savingType, setSavingType] = useState<TemplateType | null>(null);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  const handleFieldChange = (
    type: TemplateType,
    field: keyof EditingTemplate,
    value: string
  ) => {
    setEditingTemplates((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  const handleResetTemplate = (type: TemplateType) => {
    const template = DEFAULT_EMAIL_TEMPLATES[type];
    setEditingTemplates((prev) => ({
      ...prev,
      [type]: {
        name: template.name,
        subject: template.subject,
        plainBody: template.plainBody,
        senderName: template.senderName,
        replyTo: template.replyTo,
      },
    }));
    toast.success("Template reset to default");
  };

  const handleSaveTemplate = async (type: TemplateType) => {
    setSavingType(type);
    try {
      const template = editingTemplates[type];
      const payload = {
        ...template,
        type,
        imageUrls: [],
        isDefault: false,
      };

      const res = await fetch(`/api/events/${eventId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save template");
      }

      toast.success(`${type.replace(/_/g, " ")} template saved`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSavingType(null);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      {/* Placeholders Reference */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader className="pb-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowPlaceholders(!showPlaceholders)}
          >
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Available Placeholders</CardTitle>
              <Badge variant="outline" className="text-xs">
                {TEMPLATE_PLACEHOLDERS.length}
              </Badge>
            </div>
            {showPlaceholders ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </CardHeader>
        {showPlaceholders && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                <div
                  key={placeholder.variable}
                  className="flex items-center justify-between p-2 bg-white rounded border border-blue-100"
                >
                  <div className="flex-1">
                    <code className="text-xs font-mono text-blue-600 font-semibold">
                      {placeholder.variable}
                    </code>
                    <p className="text-xs text-gray-600 mt-1">{placeholder.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleCopyToClipboard(placeholder.variable)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Templates Tabs */}
      <Tabs
        value={expandedType}
        onValueChange={(v) => setExpandedType(v as TemplateType)}
      >
        <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
          {Object.keys(DEFAULT_EMAIL_TEMPLATES).map((type) => (
            <TabsTrigger key={type} value={type} className="text-xs">
              {type.replace(/_/g, " ")}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(DEFAULT_EMAIL_TEMPLATES).map(([type, defaultTemplate]) => {
          const typedType = type as TemplateType;
          const editing = editingTemplates[typedType];
          const isModified =
            JSON.stringify(editing) !==
            JSON.stringify({
              name: defaultTemplate.name,
              subject: defaultTemplate.subject,
              plainBody: defaultTemplate.plainBody,
              senderName: defaultTemplate.senderName,
              replyTo: defaultTemplate.replyTo,
            });

          return (
            <TabsContent key={type} value={type} className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {type.replace(/_/g, " ")} Template
                      </CardTitle>
                      <CardDescription>
                        Customize this template or use as-is. Variables like{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {`{{guestName}}`}
                        </code>{" "}
                        will be replaced with actual data.
                      </CardDescription>
                    </div>
                    {isModified && (
                      <Badge variant="secondary" className="text-xs">
                        Modified
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Template Name */}
                  <div className="space-y-1">
                    <Label htmlFor={`name-${type}`}>Template Name *</Label>
                    <Input
                      id={`name-${type}`}
                      value={editing.name}
                      onChange={(e) =>
                        handleFieldChange(typedType, "name", e.target.value)
                      }
                      placeholder="e.g., VIP Invitation"
                    />
                  </div>

                  {/* Sender Name */}
                  <div className="space-y-1">
                    <Label htmlFor={`sender-${type}`}>Sender Name *</Label>
                    <Input
                      id={`sender-${type}`}
                      value={editing.senderName}
                      onChange={(e) =>
                        handleFieldChange(typedType, "senderName", e.target.value)
                      }
                      placeholder="e.g., Event Team"
                    />
                  </div>

                  {/* Reply-To Email */}
                  <div className="space-y-1">
                    <Label htmlFor={`reply-${type}`}>Reply-To Email *</Label>
                    <Input
                      id={`reply-${type}`}
                      type="email"
                      value={editing.replyTo}
                      onChange={(e) =>
                        handleFieldChange(typedType, "replyTo", e.target.value)
                      }
                      placeholder="noreply@events.com"
                    />
                  </div>

                  {/* Subject Line */}
                  <div className="space-y-1">
                    <Label htmlFor={`subject-${type}`}>Subject Line *</Label>
                    <Input
                      id={`subject-${type}`}
                      value={editing.subject}
                      onChange={(e) =>
                        handleFieldChange(typedType, "subject", e.target.value)
                      }
                      placeholder="e.g., You're invited to {{eventName}}"
                    />
                    <p className="text-xs text-muted-foreground">
                      Preview: {editing.subject}
                    </p>
                  </div>

                  {/* Email Body */}
                  <div className="space-y-1">
                    <Label htmlFor={`body-${type}`}>Email Body *</Label>
                    <Textarea
                      id={`body-${type}`}
                      value={editing.plainBody}
                      onChange={(e) =>
                        handleFieldChange(typedType, "plainBody", e.target.value)
                      }
                      placeholder="Enter email template content..."
                      className="min-h-96 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use variables like {`{{guestName}}`}, {`{{eventDate}}`}, etc.
                      See reference above.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => handleSaveTemplate(typedType)}
                      disabled={savingType === typedType}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {savingType === typedType ? "Saving..." : "Save Template"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleResetTemplate(typedType)}
                      disabled={!isModified || savingType === typedType}
                    >
                      Reset
                    </Button>
                  </div>

                  {isModified && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      ⚠ You have unsaved changes. Click "Save Template" to persist them.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
