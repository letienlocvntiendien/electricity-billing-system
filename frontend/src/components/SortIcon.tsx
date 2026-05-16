import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-0.5 inline flex-shrink-0" />
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 ml-0.5 inline flex-shrink-0" />
    : <ArrowDown className="h-3 w-3 ml-0.5 inline flex-shrink-0" />
}
