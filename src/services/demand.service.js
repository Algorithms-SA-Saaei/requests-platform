// فجوات الطلب — يقارن طلب العملاء (ClientRequest) بالمعروض (Property) لكل حي/تصنيف.
// فجوة موجبة (طلب أعلى من المعروض) = فرصة للمطوّر/المسوّق.
import { ClientRequest } from '../models/ClientRequest.js';
import { Property } from '../models/Property.js';

export async function demandGaps({ limit = 50 } = {}) {
  const [demand, supply] = await Promise.all([
    ClientRequest.aggregate([
      { $match: { district: { $ne: null }, category: { $ne: null } } },
      { $group: { _id: { d: '$district', c: '$category' }, n: { $sum: 1 } } },
    ]),
    Property.aggregate([
      { $match: { active: true, district: { $ne: null }, category: { $ne: null } } },
      { $group: { _id: { d: { $replaceOne: { input: '$district', find: 'حي ', replacement: '' } }, c: '$category' }, n: { $sum: 1 } } },
    ]),
  ]);
  const sup = new Map();
  for (const s of supply) sup.set(s._id.d + '|' + s._id.c, s.n);
  const rows = demand.map((d) => {
    const key = d._id.d + '|' + d._id.c;
    const s = sup.get(key) || 0;
    return { district: d._id.d, category: d._id.c, demand: d.n, supply: s, gap: d.n - s, ratio: s ? Math.round((d.n / s) * 100) / 100 : null };
  });
  // أعلى فجوة أولًا (طلب مرتفع ومعروض منخفض)
  return rows.sort((a, b) => b.gap - a.gap).slice(0, limit);
}
