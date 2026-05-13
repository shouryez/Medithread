export default function Logo({ size = 'md' }) {
  const sizes = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl', xl: 'text-5xl' }
  return (
    <span className={`font-bold tracking-tight ${sizes[size]}`}>
      <span style={{ color: '#e2e8f4' }}>Medi</span>
      <span style={{ color: '#00e5ff' }}>Thread</span>
    </span>
  )
}
