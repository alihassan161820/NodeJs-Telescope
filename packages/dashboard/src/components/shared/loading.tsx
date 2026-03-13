interface LoadingProps {
  className?: string;
}

export function Loading({ className = '' }: LoadingProps) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="w-8 h-8 border-2 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}
