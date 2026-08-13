// فحص وحدة منصة الطلبات — دوال نقية (بلا قاعدة/شبكة). يشغّله DevOps للتأكد قبل النشر.
// الاستخدام:  node scripts/verify-requests.js
import assert from 'node:assert/strict';
import { extractRequest, requestSummary } from '../src/services/saaeiRequests.service.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓', name); } catch (e) { fail++; console.error('✗', name, '—', e.message); } };

// عيّنة طلب حقيقي من بنية ساعي
const sample = {
  id: 4638, fullname: 'I.sami0 العنزي', phone: '+966539670992',
  priceFrom: 600000, priceTo: 720000, bedrooms: 3, status: 'NEW', clientType: 'HOUSING', firstHousing: true,
  hasSuggestedAdvertisements: false, createdAt: '2026-08-11T14:37:26.624Z',
  subCategory: { categoryName: 'Apartment', id: 8 }, city: { cityName: 'Riyadh', id: 1 },
  area: { areaName: 'An Narjis', id: 100 }, user: { fullname: 'نواف القاسم', id: 14530 },
};

check('extract: النوع Apartment → شقة', () => assert.equal(extractRequest(sample).category, 'شقة'));
check('extract: الحي An Narjis → النرجس (حرف شمسي)', () => assert.equal(extractRequest(sample).district, 'النرجس'));
check('extract: السعر من/إلى', () => { const r = extractRequest(sample); assert.equal(r.priceMin, 600000); assert.equal(r.priceMax, 720000); });
check('extract: الغرف', () => assert.equal(extractRequest(sample).beds, 3));
check('extract: الغرض HOUSING → بيع', () => assert.equal(extractRequest(sample).purpose, 'بيع'));
check('extract: الموظف من user.fullname', () => assert.equal(extractRequest(sample).employee, 'نواف القاسم'));
check('extract: matched=false في القائمة → null (لا يُميَّز إلا بفلتر الخادم)', () => assert.equal(extractRequest(sample).matched, null));
check('extract: hasSuggestedAdvertisements=true → matched=1', () => assert.equal(extractRequest({ ...sample, hasSuggestedAdvertisements: true }).matched, 1));
check('normCat: duplex → فيلا', () => assert.equal(extractRequest({ ...sample, subCategory: { categoryName: 'duplex' } }).category, 'فيلا'));
check('normArea: عربي يُبقى بلا بادئة حي', () => assert.equal(extractRequest({ ...sample, area: { areaName: 'حي الملقا' } }).district, 'الملقا'));
check('summary: يبني نصًّا مقروءًا', () => { const s = requestSummary(extractRequest(sample)); assert.ok(s.includes('شقة') && s.includes('النرجس')); });

console.log(`\nالنتيجة: ${pass} ناجح · ${fail} فاشل`);
process.exit(fail ? 1 : 0);
