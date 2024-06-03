import Suggest from './components/suggest';

export default function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-between p-3'>
      <div className='flex flex-col w-full'>
        <div className='flex flex-col space-y-3 items-center py-6'>
          <div className='text-3xl font-bold text-center'>
            🍃 Anglish Thesaurus
          </div>
        </div>
        <Suggest />
      </div>
      <div className='flex flex-col w-full max-w-xl'>footer</div>
    </main>
  );
}
