import type { APIRoute } from 'astro';
import { Resend } from 'resend';

// Disable prerendering for this API route (required for server-side features)
export const prerender = false;

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

// Clean up old entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
      if (now - record.timestamp > RATE_LIMIT_WINDOW) {
        rateLimitMap.delete(ip);
      }
    }
  }, 60 * 1000);
}

// Validation helpers
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9;
}

function sanitize(str: string): string {
  return str.trim().slice(0, 2000); // Limit length
}

// Format data for email
function formatLeadEmail(data: Record<string, string>): string {
  const sections = [
    '## Nowe zgłoszenie - Argentech\n',
    '### Dane kontaktowe',
    `- **Email:** ${data.email}`,
    `- **Telefon:** ${data.phone}`,
    '',
    '### Informacje o budynku',
    `- **Typ budynku:** ${data.buildingType}`,
    `- **Powierzchnia:** ${data.area} m²`,
    `- **Województwo:** ${data.location}`,
  ];
  
  if (data.currentHeating) {
    sections.push(`- **Aktualne źródło ciepła:** ${data.currentHeating}`);
  }
  
  if (data.installation) {
    sections.push(`- **Instalacja grzewcza:** ${data.installation}`);
  }
  
  sections.push('');
  sections.push('### Dodatkowe informacje');
  
  if (data.hasPV) {
    let pvInfo = data.hasPV;
    if (data.pvPower) {
      pvInfo += ` (${data.pvPower} kWp)`;
    }
    sections.push(`- **Fotowoltaika:** ${pvInfo}`);
  }
  
  if (data.hasStorage) {
    let storageInfo = data.hasStorage;
    if (data.storageCapacity) {
      storageInfo += ` (${data.storageCapacity} kWh)`;
    }
    sections.push(`- **Magazyn energii:** ${storageInfo}`);
  }
  
  if (data.notes) {
    sections.push('');
    sections.push('### Uwagi od klienta');
    sections.push(data.notes);
  }
  
  sections.push('');
  sections.push('---');
  sections.push(`Zgłoszenie z: ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}`);
  
  return sections.join('\n');
}

function formatLeadHtml(data: Record<string, string>): string {
  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #243B53; border-bottom: 2px solid #243B53; padding-bottom: 10px;">Nowe zgłoszenie - Argentech</h2>
      
      <h3 style="color: #2c3039; margin-top: 24px;">Dane kontaktowe</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #5c6370; width: 40%;">Email:</td>
          <td style="padding: 8px 0; color: #2c3039;"><strong>${data.email}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #5c6370;">Telefon:</td>
          <td style="padding: 8px 0; color: #2c3039;"><strong>${data.phone}</strong></td>
        </tr>
      </table>
      
      <h3 style="color: #2c3039; margin-top: 24px;">Informacje o budynku</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #5c6370; width: 40%;">Typ budynku:</td>
          <td style="padding: 8px 0; color: #2c3039;">${data.buildingType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #5c6370;">Powierzchnia:</td>
          <td style="padding: 8px 0; color: #2c3039;">${data.area} m²</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #5c6370;">Województwo:</td>
          <td style="padding: 8px 0; color: #2c3039;">${data.location}</td>
        </tr>
  `;
  
  if (data.currentHeating) {
    html += `
        <tr>
          <td style="padding: 8px 0; color: #5c6370;">Aktualne źródło ciepła:</td>
          <td style="padding: 8px 0; color: #2c3039;">${data.currentHeating}</td>
        </tr>
    `;
  }
  
  if (data.installation) {
    html += `
        <tr>
          <td style="padding: 8px 0; color: #5c6370;">Instalacja grzewcza:</td>
          <td style="padding: 8px 0; color: #2c3039;">${data.installation}</td>
        </tr>
    `;
  }
  
  html += `</table>`;
  
  // Optional fields
  if (data.hasPV || data.hasStorage) {
    html += `<h3 style="color: #2c3039; margin-top: 24px;">Dodatkowe informacje</h3>
      <table style="width: 100%; border-collapse: collapse;">`;
    
    if (data.hasPV) {
      let pvInfo = data.hasPV;
      if (data.pvPower) {
        pvInfo += ` (${data.pvPower} kWp)`;
      }
      html += `
        <tr>
          <td style="padding: 8px 0; color: #5c6370; width: 40%;">Fotowoltaika:</td>
          <td style="padding: 8px 0; color: #2c3039;">${pvInfo}</td>
        </tr>
      `;
    }
    
    if (data.hasStorage) {
      let storageInfo = data.hasStorage;
      if (data.storageCapacity) {
        storageInfo += ` (${data.storageCapacity} kWh)`;
      }
      html += `
        <tr>
          <td style="padding: 8px 0; color: #5c6370;">Magazyn energii:</td>
          <td style="padding: 8px 0; color: #2c3039;">${storageInfo}</td>
        </tr>
      `;
    }
    
    html += `</table>`;
  }
  
  if (data.notes) {
    html += `
      <h3 style="color: #2c3039; margin-top: 24px;">Uwagi od klienta</h3>
      <p style="color: #2c3039; background-color: #f5f6f7; padding: 12px; border-radius: 4px;">${data.notes.replace(/\n/g, '<br>')}</p>
    `;
  }
  
  html += `
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #e2e4e8;">
      <p style="color: #7a8291; font-size: 12px;">
        Zgłoszenie z: ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}
      </p>
    </div>
  `;
  
  return html;
}

function getConfirmationEmailHtml(): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #243B53;">Dziękujemy za zgłoszenie</h2>
      <p style="color: #2c3039; line-height: 1.6;">
        Otrzymaliśmy Twoje zgłoszenie dotyczące analizy systemu grzewczego.
      </p>
      <p style="color: #2c3039; line-height: 1.6;">
        <strong>Skontaktujemy się w ciągu 24–48 godzin</strong>, aby omówić szczegóły 
        i przygotować indywidualną wycenę.
      </p>
      <p style="color: #2c3039; line-height: 1.6;">
        W międzyczasie, jeśli masz dodatkowe pytania, możesz odpowiedzieć na tę wiadomość.
      </p>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #e2e4e8;">
      <p style="color: #7a8291; font-size: 12px;">
        Argentech – Niezależne doradztwo techniczne
      </p>
    </div>
  `;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Check environment variables
  const apiKey = import.meta.env.RESEND_API_KEY;
  const toEmail = import.meta.env.LEAD_TO_EMAIL;
  const fromEmail = import.meta.env.LEAD_FROM_EMAIL;
  
  if (!apiKey || !toEmail || !fromEmail) {
    console.error('Missing required environment variables for email sending');
    return new Response(
      JSON.stringify({ error: 'Konfiguracja serwera nieprawidłowa. Proszę spróbować później.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Rate limiting - use clientAddress or fallback to header
  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: 'Zbyt wiele zgłoszeń. Proszę spróbować za chwilę.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Parse body
  let data: Record<string, string>;
  try {
    data = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Nieprawidłowe dane.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Server-side validation
  const errors: string[] = [];
  
  if (!data.buildingType || !['nowy', 'istniejący'].includes(data.buildingType)) {
    errors.push('Nieprawidłowy typ budynku');
  }
  
  const area = parseFloat(data.area);
  if (isNaN(area) || area < 20 || area > 2000) {
    errors.push('Nieprawidłowa powierzchnia');
  }
  
  if (!data.location || !data.location.trim()) {
    errors.push('Brak województwa');
  }
  
  if (!data.email || !validateEmail(data.email)) {
    errors.push('Nieprawidłowy adres email');
  }
  
  if (!data.phone || !validatePhone(data.phone)) {
    errors.push('Nieprawidłowy numer telefonu');
  }
  
  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ error: errors.join('. ') }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Sanitize data
  const sanitizedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitizedData[key] = sanitize(value);
    }
  }
  
  // Send email via Resend
  const resend = new Resend(apiKey);
  const replyTo = import.meta.env.LEAD_REPLY_TO_EMAIL || sanitizedData.email;
  
  try {
    // Send lead notification to business
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: sanitizedData.email,
      subject: `Nowe zgłoszenie - ${sanitizedData.buildingType} ${sanitizedData.area}m² (${sanitizedData.location})`,
      text: formatLeadEmail(sanitizedData),
      html: formatLeadHtml(sanitizedData),
    });
    
    // Send confirmation to user
    await resend.emails.send({
      from: fromEmail,
      to: sanitizedData.email,
      replyTo: replyTo,
      subject: 'Argentech - Potwierdzenie zgłoszenia',
      html: getConfirmationEmailHtml(),
    });
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Failed to send email:', error);
    return new Response(
      JSON.stringify({ error: 'Nie udało się wysłać zgłoszenia. Proszę spróbować ponownie.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

