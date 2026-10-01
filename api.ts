/**
 * Robust JSON fetch wrapper that guards against HTML responses and provides clear errors
 */
export async function fetchJson<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`خطأ من الخادم (${res.status}): ${text.slice(0, 120) || 'استجابة غير صالحة'}`);
    }
    throw new Error(`استجابة غير متوقعة من الخادم: ${text.slice(0, 100)}`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `فشل الطلب برمز ${res.status}`);
  }
  return data;
}
