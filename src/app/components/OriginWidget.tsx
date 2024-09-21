import React from 'react';

const OriginWidget: React.FC<{ text?: string; rank?: string }> = ({
  text,
  rank,
}) => {
  return (
    <div className='border rounded-lg border-stone-300 p-3 space-y-2'>
      <div className='uppercase tracking-wider font-bold text-stone-400 text-sm text-center'>
        Origin
        {rank && ` ${rank}`}
      </div>
      <div className='w-full flex justify-center'>
        {text ? (
          <p>{text}</p>
        ) : (
          <button className='my-1 px-3 py-2 rounded bg-stone-200 text-xs uppercase tracking-wide font-bold text-stone-900'>
            Add Origin
          </button>
        )}
      </div>
    </div>
  );
};

export default OriginWidget;
