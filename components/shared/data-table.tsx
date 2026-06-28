"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MoreVerticalIcon,
  SearchIcon,
} from "lucide-react";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  /** When set (and onSortChange is provided), the header becomes a sort toggle. */
  sortKey?: string;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  /** Short label used as the placeholder when no value is selected. */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

export interface RowAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  /** Render a separator above this action. */
  separatorBefore?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  filters?: FilterConfig[];
  rowActions?: (row: T) => RowAction[];
  isLoading?: boolean;
  /** Active sort column key + direction (controlled by the parent). */
  sortKey?: string;
  sortDir?: "asc" | "desc";
  /** Called with a column's sortKey when its header is clicked. */
  onSortChange?: (key: string) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  searchPlaceholder = "Search...",
  onSearch,
  filters,
  rowActions,
  isLoading,
  sortKey,
  sortDir,
  onSortChange,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = () => {
    onSearch?.(searchQuery);
  };

  const hasToolbar = !!onSearch || (filters && filters.length > 0);
  // Total column count including the trailing actions column (if any).
  const colCount = columns.length + (rowActions ? 1 : 0);

  return (
    <div className="space-y-4">
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {onSearch && (
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={handleSearch}>
                Search
              </Button>
            </div>
          )}

          {filters?.map((filter, i) => (
            <Select key={i} value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger size="sm" className="w-auto min-w-32">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => {
                const sortable = col.sortKey && onSortChange;
                if (!sortable) return <TableHead key={i}>{col.header}</TableHead>;
                const active = sortKey === col.sortKey;
                const Arrow = !active ? ChevronsUpDownIcon : sortDir === "asc" ? ChevronUpIcon : ChevronDownIcon;
                return (
                  <TableHead key={i}>
                    <button
                      type="button"
                      onClick={() => onSortChange!(col.sortKey!)}
                      className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
                    >
                      {col.header}
                      <Arrow className={`size-3.5 ${active ? "" : "opacity-50"}`} />
                    </button>
                  </TableHead>
                );
              })}
              {rowActions && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {columns.map((col, colIdx) => (
                    <TableCell key={colIdx}>
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                          ? String(row[col.accessorKey] ?? "")
                          : ""}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className="text-right">
                      {rowActions(row).length > 0 && <RowActionsMenu actions={rowActions(row)} />}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Row actions">
          <MoreVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <div key={i}>
              {action.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant={action.variant}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {Icon && <Icon className="size-4" />}
                {action.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
