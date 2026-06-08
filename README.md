# AutoDealer Pro Web PWA

نسخة ويب احترافية لنظام إدارة معارض السيارات، مبنية على Nuxt 3/4 + Tailwind + Pinia + PWA + Prisma + PostgreSQL/Neon.

## التشغيل المحلي

1. انسخ `.env.example` إلى `.env` وضع رابط Neon الحقيقي.
2. ثبت الحزم:

```bash
npm install
```

3. أنشئ الجداول:

```bash
npx prisma db push
```

4. أنشئ حساب المدير:

```bash
npm run db:seed
```

5. شغل المشروع:

```bash
npm run dev
```

بيانات الدخول الافتراضية:

```txt
admin
admin123
```

## الرفع

GitHub ثم Vercel، وأضف متغيرات البيئة في Vercel:

```env
DATABASE_URL="..."
JWT_SECRET="..."
NUXT_PUBLIC_SITE_URL="https://your-domain.com"
```
