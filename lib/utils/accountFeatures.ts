// lib/utils/accountFeatures.ts
//
// What Jageer's finance pages offer. Several finance files were merged from Finance Nepal (a separate product with
// its own database) and ask these questions; Jageer's answers: no vehicle accounts, no Rent & EMI, no built-in
// logos, the blue banner for everyone. Jageer's finance code is maintained here on its own - it is not kept in step
// with Finance Nepal's.
import type { BillItem } from '../../types/database.types';

/** What this app's finance pages offer. */
export const FINANCE_FEATURES = {
  /** Rent & EMI (rentals, EMI plans, employees' daily rental wages) - tables only Finance Nepal's database has. */
  rentAndEmi: false,
  /** Receivable / Payable reports in the Ledger page's own table for every account (otherwise only vehicle accounts). */
  ledgerTableReports: true,
} as const;

/** A vehicle account (Purchase Report and Paid page name the vehicle, Inventory per vehicle ...). None in Jageer. */
export function sellsVehicles(_businessName: string | null | undefined): boolean {
  return false;
}

export interface BannerColors {
  /** The flat band (Finance, Report). */
  solid: string;
  /** The Dashboard's gradient, corner to corner. */
  gradient: [string, string, string];
  /** The light tints for the small text on the band, strongest first. */
  label: string;
  sub: string;
  soft: string;
  delta: string;
}

const BLUE_BANNER: BannerColors = { solid: '#1E3A8A', gradient: ['#0F172A', '#1E3A8A', '#2563EB'], label: '#BFDBFE', sub: '#DBEAFE', soft: '#EFF6FF', delta: '#93C5FD' };

/** The colours of the big band at the top of the Dashboard, Finance and Report pages: the app's blue. */
export function bannerColors(_businessName: string | null | undefined): BannerColors {
  return BLUE_BANNER;
}

/** A logo kept with the app for an account that has not uploaded one. None in Jageer. */
export function builtInLogo(_businessName: string | null | undefined): number | null {
  return null;
}

/** The same built-in logo at full size. None in Jageer. */
export function builtInLogoLarge(_businessName: string | null | undefined): number | null {
  return null;
}

/** The logo straight on the Dashboard's top band. None in Jageer. */
export function builtInLogoBanner(_businessName: string | null | undefined): number | null {
  return null;
}

/** The names of a bill's items, each once, in the order they are on the bill. */
export function itemListOf(items: BillItem[] | null | undefined): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of items ?? []) {
    const name = item.description?.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      names.push(name);
    }
  }
  return names;
}

/** The model numbers entered on a bill's items, each once, as one line: "2015, 2016". Empty when none was entered. */
export function modelNamesOf(items: BillItem[] | null | undefined): string {
  const seen = new Set<string>();
  const models: string[] = [];
  for (const item of items ?? []) {
    const model = item.model?.trim();
    if (model && !seen.has(model.toLowerCase())) {
      seen.add(model.toLowerCase());
      models.push(model);
    }
  }
  return models.join(', ');
}

/** The same, as one line: "Honda Shine, Bajaj Pulsar". */
export function itemNamesOf(items: BillItem[] | null | undefined): string {
  return itemListOf(items).join(', ');
}
