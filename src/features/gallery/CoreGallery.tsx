import { ArrowRight, Bell, Building2, CircleCheck, Clock, CreditCard, FileText, Search, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Chip, ChipRow, Icon, IconButton, List, Pill, Row, Section, Segmented, Sheet, toast } from '@/design/core';

const tile = { width: 40, height: 40, borderRadius: 12, background: 'var(--accent-tint)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center' } as const;

export function CoreGallery() {
  const [view, setView] = useState<'active' | 'done'>('active');
  const [chip, setChip] = useState('all');
  const [sheet, setSheet] = useState(false);
  return (
    <>
      <Section title="Buttons">
        <div style={{ display: 'grid', gap: 10 }}>
          <Button block>راجِع ووقّع</Button>
          <Button block variant="secondary" icon={CreditCard}>
            ادفع 30,000 ر.ق
          </Button>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button size="md">متابعة</Button>
            <Button size="md" variant="secondary" trailingIcon={ArrowRight} flipIcons>
              التالي
            </Button>
            <Button size="md" variant="quiet">
              عرض الكل
            </Button>
            <Button size="md" variant="danger">
              إلغاء الطلب
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="sm">تتبّع</Button>
            <Button size="sm" variant="secondary">
              تفاصيل
            </Button>
            <Button size="md" loading>
              جارٍ الإرسال
            </Button>
            <Button size="md" disabled>
              غير متاح
            </Button>
            <IconButton icon={Bell} label="الإشعارات" badge={3} />
            <IconButton icon={Search} label="بحث" variant="soft" />
          </div>
        </div>
      </Section>

      <Section title="Cards and pills">
        <Card tone="accent" pad="lg">
          <p style={{ fontSize: 'var(--t-foot)', fontWeight: 600, color: 'var(--accent-ink)' }}>الخطوة التالية</p>
          <h3 style={{ fontSize: 'var(--t-title)', fontWeight: 700, marginBlock: '4px 6px' }}>وقّع عقد الإيجار</h3>
          <p style={{ color: 'var(--ink-2)', fontSize: 'var(--t-callout)', marginBlockEnd: 16 }}>القطعة محجوزة لك حتى 30 نوفمبر.</p>
          <Button block>راجِع ووقّع</Button>
        </Card>
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill>محايد</Pill>
            <Pill tone="accent">عندك</Pill>
            <Pill tone="ok" icon={CircleCheck}>
              مكتمل
            </Pill>
            <Pill tone="warn" icon={Clock}>
              يستحق خلال 5 أيام
            </Pill>
            <Pill tone="bad">متأخر</Pill>
            <Pill tone="info">عند وزارة البلدية</Pill>
            <Pill tone="gold">موثّق</Pill>
            <Pill tone="accent" solid>
              جديد
            </Pill>
          </div>
        </Card>
        <Card tone="sunken" pad="sm">
          <p style={{ fontSize: 'var(--t-foot)', color: 'var(--ink-2)' }}>بطاقة غائرة للملاحظات الهادئة.</p>
        </Card>
      </Section>

      <Section title="طلبات جارية" action={{ label: 'عرض الكل', onClick: () => toast('كل الطلبات') }}>
        <List>
          <Row
            to="/gallery"
            leading={
              <span style={tile}>
                <Icon icon={Building2} size={20} />
              </span>
            }
            title="رخصة البناء"
            subtitle="عند وزارة البلدية · اليوم 2 من 5"
            trailing={<Pill tone="info">جارٍ</Pill>}
          />
          <Row
            to="/gallery"
            leading={
              <span style={tile}>
                <Icon icon={Wrench} size={20} />
              </span>
            }
            title="صيانة إنارة الطريق"
            subtitle="الفريق الميداني في الطريق إليك"
          />
          <Row
            leading={
              <span style={tile}>
                <Icon icon={FileText} size={20} />
              </span>
            }
            eyebrow="MQ-2611-0042"
            title="شهادة إيجار"
            subtitle="صدرت اليوم"
            trailing="PDF"
          />
        </List>
      </Section>

      <Section title="Segmented and chips">
        <Segmented
          label="الحالة"
          value={view}
          onChange={setView}
          options={[
            { value: 'active', label: 'جارية', count: 3 },
            { value: 'done', label: 'مكتملة', count: 12 },
          ]}
        />
        <ChipRow label="نوع الحل">
          {[
            ['all', 'الكل'],
            ['logistics', 'لوجستي'],
            ['industrial', 'صناعي'],
            ['commercial', 'تجاري'],
            ['openYard', 'ساحات مفتوحة'],
            ['warehousing', 'تخزين'],
          ].map(([value, label]) => (
            <Chip key={value} selected={chip === value} onClick={() => setChip(value as string)}>
              {label}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      <Section title="Sheet and toast">
        <div style={{ display: 'flex', gap: 10 }}>
          <Button size="md" variant="secondary" onClick={() => setSheet(true)}>
            افتح الورقة
          </Button>
          <Button size="md" variant="secondary" onClick={() => toast('تم إرسال طلبك')}>
            أظهر تنبيهًا
          </Button>
        </div>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="ادفع الفاتورة" description="إيجار الربع الرابع 2026 · القطعة BA-214" footer={<Button block onClick={() => setSheet(false)}>ادفع 30,000 ر.ق</Button>}>
          <List variant="plain">
            <Row title="المبلغ" trailing="30,000 ر.ق" />
            <Row title="تاريخ الاستحقاق" trailing="5 ديسمبر 2026" />
          </List>
        </Sheet>
      </Section>
    </>
  );
}
