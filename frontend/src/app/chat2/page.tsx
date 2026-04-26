import { redirect } from "next/navigation";

type Chat2PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Chat2Page({ searchParams }: Chat2PageProps) {
  const params = (await searchParams) ?? {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  redirect(queryString ? `/chat?${queryString}` : "/chat");
}
