// lib/utils/expenseGroups.ts

/** Same name whatever the case or spacing - how names are told apart. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const wordsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean);

/** Whether an expense name is an advance paid to staff - "Salary Advance", "Employee Advance",
 * "Staff Advance". They are one thing under three names, so the Expense Report keeps them under
 * one header (see advanceHeader). */
export function isAdvanceName(name: string): boolean {
  return /\b(employees?|staff|salary)\b/i.test(name) && /\badvance\b/i.test(name);
}

/** The header the advances go under: the "Salary Advance" you already have, else whichever advance
 * name there is, else "Salary Advance". */
export function advanceHeader(names: readonly string[]): string {
  const advances = names.filter(isAdvanceName);
  return advances.find((n) => /\bsalary\b/i.test(n)) ?? advances[0] ?? 'Salary Advance';
}

/** The category each expense name belongs to, from the words it starts with: "Fuel Aviator",
 * "Fuel Manish" and "Fuel" are all Fuel; "Bike Repair 220 Blue" and "Bike Repair Aviator" are
 * Bike Repair - the words every name in the group starts with. A name that no other shares a
 * first word with is its own category.
 *
 * Returns nameKey(name) -> the category's label. */
export function groupExpenseNames(names: readonly string[]): Map<string, string> {
  const byFirstWord = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const name of names) {
    const key = nameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const first = key.split(' ')[0];
    const members = byFirstWord.get(first);
    if (members) members.push(name.trim().replace(/\s+/g, ' '));
    else byFirstWord.set(first, [name.trim().replace(/\s+/g, ' ')]);
  }

  const labelOf = new Map<string, string>();
  for (const members of byFirstWord.values()) {
    let common = wordsOf(members[0]);
    for (const member of members.slice(1)) {
      const words = wordsOf(member);
      let i = 0;
      while (i < common.length && i < words.length && common[i].toLowerCase() === words[i].toLowerCase()) i++;
      common = common.slice(0, i);
    }
    const label = members.length > 1 ? common.join(' ') : members[0];
    for (const member of members) labelOf.set(nameKey(member), label);
  }
  return labelOf;
}
