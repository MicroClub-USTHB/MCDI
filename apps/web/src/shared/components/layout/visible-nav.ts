import {
  NAV_GROUPS,
  type NavContext,
  type NavGroup,
  type NavLink,
} from '@/shared/components/layout/nav-items';
import { canAccess, type AccessSubject } from '@/shared/lib/access';
import { requirementForPath } from '@/shared/lib/route-access';

export interface VisibleGroup {
  group: NavGroup;
  items: NavLink[];
  /** The group's context with only the sub-items the member can open; undefined when its list is not allowed. */
  context: NavContext | undefined;
}

function allowed(subject: AccessSubject | null, path: string): boolean {
  const requirement = requirementForPath(path);
  return requirement !== null && canAccess(subject, requirement);
}

/** The sidebar as the member sees it: a link shows when its page is allowed, a group when anything in it shows. */
export function visibleNavGroups(subject: AccessSubject | null): VisibleGroup[] {
  return NAV_GROUPS.flatMap((group) => {
    const items = group.items.filter((item) => allowed(subject, item.route));

    let context: NavContext | undefined;
    if (group.context && allowed(subject, group.context.list.route)) {
      const base = group.context.base;
      // Any id matches the `[id]` of the route table, so a placeholder stands in for the selected one.
      const subItems = group.context.subItems.filter((item) =>
        allowed(subject, item.segment ? `${base}/_/${item.segment}` : `${base}/_`)
      );
      if (subItems.length > 0) context = { ...group.context, subItems };
    }

    return items.length > 0 || context ? [{ group, items, context }] : [];
  });
}

/** Where to send a member who cannot open the page they asked for. */
export function firstAllowedHref(subject: AccessSubject | null): string {
  for (const { items, context } of visibleNavGroups(subject)) {
    const first = items[0]?.route ?? context?.list.route;
    if (first) return first;
  }
  return '/dashboard/settings';
}
