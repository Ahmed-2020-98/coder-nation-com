import "server-only";
import { z } from "zod";
import { EMAIL_RE } from "@/lib/crm-rules";
import { sql } from "./db";

export type Company = { name: string; address: string; email: string; phone: string; taxNumber: string };

export const companySchema = z.object({
  name: z.string().trim().min(2, "اسم الشركة قصير جدًا").max(120),
  address: z.string().trim().max(300),
  email: z.string().trim().max(254).refine((v) => v === "" || EMAIL_RE.test(v), "إيميل غير صحيح"),
  phone: z.string().trim().max(40),
  taxNumber: z.string().trim().max(40),
});

export async function getCompany(): Promise<Company> {
  const [row] = await sql()<{ name: string; address: string; email: string; phone: string; tax_number: string }[]>`
    select name, address, email, phone, tax_number from company_settings where id = 1`;
  return { name: row?.name ?? "", address: row?.address ?? "", email: row?.email ?? "", phone: row?.phone ?? "", taxNumber: row?.tax_number ?? "" };
}

export async function saveCompany(company: Company): Promise<void> {
  await sql()`
    insert into company_settings (id, name, address, email, phone, tax_number, updated_at)
    values (1, ${company.name}, ${company.address}, ${company.email}, ${company.phone}, ${company.taxNumber}, now(3))
    on duplicate key update name = values(name), address = values(address), email = values(email),
                            phone = values(phone), tax_number = values(tax_number), updated_at = now(3)`;
}
