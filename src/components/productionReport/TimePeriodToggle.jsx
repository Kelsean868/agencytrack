import TabPills from '../ui/TabPills';

const PERIODS = [
  { id: 'week',    label: 'Week'    },
  { id: 'mtd',     label: 'MTD'     },
  { id: 'quarter', label: 'Quarter' },
  { id: 'ytd',     label: 'YTD'     },
];

export default function TimePeriodToggle({ selected, onChange }) {
  return <TabPills tabs={PERIODS} activeId={selected} onChange={onChange} />;
}
