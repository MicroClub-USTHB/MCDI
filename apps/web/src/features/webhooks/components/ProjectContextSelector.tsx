'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

export interface ProjectOption {
  id: string;
  name: string;
}

interface ProjectContextSelectorProps {
  projects: ProjectOption[];
  selected: string | null;
  onChange: (projectId: string) => void;
  disabled?: boolean;
}

/** Picks which project's webhooks the table shows. */
export function ProjectContextSelector({
  projects,
  selected,
  onChange,
  disabled,
}: ProjectContextSelectorProps) {
  return (
    <Select
      value={selected ?? undefined}
      onValueChange={onChange}
      disabled={disabled || projects.length === 0}
    >
      <SelectTrigger aria-label="Select a project" className="w-64">
        <SelectValue placeholder="Select a project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
