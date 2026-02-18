"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { useToast } from "@/components/toast";
import { SkillDialog } from "./skill-dialog";
import {
  SKILL_TEMPLATES,
  TOOL_CATEGORIES,
  type ToolTemplate,
} from "@/lib/tools-registry";
import {
  Sparkles, Command, ShoppingBag, Search, CheckCircle,
  Plus, Pencil, Trash2, AlertCircle, X,
} from "lucide-react";
import { OnlineSearch } from "./online-search";
import type { SkillInfo, CommandInfo } from "./types";

interface ExpandableCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function ExpandableCard({ title, subtitle, icon, badge, children }: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={expanded ? "ring-1 ring-primary/20" : ""}>
      <div className="px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {icon}
            <div className="min-w-0">
              <div className="text-sm font-mono font-semibold truncate">{title}</div>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>}
            </div>
          </div>
          <div className="flex-shrink-0">{badge}</div>
        </div>
      </div>
      {expanded && (
        <CardContent className="pt-0 border-t mt-2">
          <div className="pt-3">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

interface SkillsTabProps {
  skills: SkillInfo[];
  commands: CommandInfo[];
  onRefresh: () => void;
}

export function SkillsTab({ skills, commands, onRefresh }: SkillsTabProps) {
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingSkill, setEditingSkill] = useState<SkillInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<SkillInfo | null>(null);

  const installedNames = new Set(skills.map(s => s.name));

  const filteredTemplates = SKILL_TEMPLATES.filter((template) => {
    const matchesCategory = categoryFilter === "All" || template.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = async (template: ToolTemplate) => {
    setInstalling(template.name);
    try {
      const res = await fetch("/api/toolbox/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: template.name, content: template.content }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "Skill installed successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Installation failed", "error");
      }
    } catch {
      toast("Failed to install skill", "error");
    } finally {
      setInstalling(null);
    }
  };

  const handleAddSkill = () => {
    setDialogMode("add");
    setEditingSkill(null);
    setDialogOpen(true);
  };

  const handleEditSkill = (skill: SkillInfo) => {
    setDialogMode("edit");
    setEditingSkill(skill);
    setDialogOpen(true);
  };

  const handleDeleteClick = (skill: SkillInfo) => {
    setSkillToDelete(skill);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!skillToDelete) return;
    try {
      const res = await fetch("/api/toolbox/skills", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: skillToDelete.name }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "Skill deleted successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Failed to delete skill", "error");
      }
    } catch {
      toast("Failed to delete skill", "error");
    } finally {
      setDeleteDialogOpen(false);
      setSkillToDelete(null);
    }
  };

  const hasInstalledItems = skills.length > 0 || commands.length > 0;

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={handleAddSkill} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create Skill
        </Button>
      </div>
      <div className="space-y-6">
        {/* Installed Skills */}
        {skills.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Installed Skills</span>
              <Badge variant="outline" className="text-xs">{skills.length}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {skills.map((skill) => (
                <div key={skill.name} className="group relative">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-mono truncate">{skill.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); handleEditSkill(skill); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(skill); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {skill.allowedTools && skill.allowedTools.length > 0 && (
                      <CardContent className="pt-0 pb-2">
                        <div className="flex gap-1 flex-wrap">
                          {skill.allowedTools.slice(0, 3).map(t => (
                            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                          ))}
                          {skill.allowedTools.length > 3 && <Badge variant="outline" className="text-[10px]">+{skill.allowedTools.length - 3}</Badge>}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Installed Commands */}
        {commands.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Command className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold">Slash Commands</span>
              <Badge variant="outline" className="text-xs">{commands.length}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {commands.map((cmd) => (
                <ExpandableCard
                  key={cmd.name}
                  title={`/${cmd.name}`}
                  subtitle={cmd.description}
                  icon={<div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0"><Command className="h-3.5 w-3.5 text-purple-500" /></div>}
                >
                  <MarkdownContent content={cmd.content} className="text-xs" />
                </ExpandableCard>
              ))}
            </div>
          </section>
        )}

        {/* Separator */}
        {hasInstalledItems && <div className="border-t my-6" />}

        {/* Skill Templates Marketplace */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Skill Templates</span>
            <Badge variant="outline" className="text-xs">{SKILL_TEMPLATES.length}</Badge>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="flex gap-1 flex-wrap">
              {TOOL_CATEGORIES.skills.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search templates..."
                className="w-full h-7 pl-7 pr-2 text-xs border rounded-md bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No templates found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredTemplates.map((template) => {
                const isInstalled = installedNames.has(template.name);
                return (
                  <Card key={template.name} className="group hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-3 px-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-mono font-semibold truncate">{template.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{template.description}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">{template.category}</Badge>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        {isInstalled ? (
                          <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400">
                            <CheckCircle className="h-2.5 w-2.5 mr-1" /> Installed
                          </Badge>
                        ) : <div />}
                        <Button
                          size="sm"
                          variant={isInstalled ? "outline" : "default"}
                          className="h-7 text-xs"
                          onClick={() => handleInstall(template)}
                          disabled={isInstalled || installing === template.name}
                        >
                          {installing === template.name ? "Installing..." : isInstalled ? "Reinstall" : "Install"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <OnlineSearch type="skill" />
      </div>

      <SkillDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        skill={editingSkill}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation */}
      {deleteDialogOpen && skillToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteDialogOpen(false)}>
          <div
            className="bg-background border rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Skill
              </h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the skill{" "}
                <span className="font-mono font-semibold text-foreground">{skillToDelete.name}</span>?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">This action cannot be undone.</p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
