import Suggest from './components/suggest';

export default function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-between p-24'>
      <div className='flex flex-col space-y-6 w-full max-w-md py-24'>
        <div className='flex flex-col space-y-6 items-center py-6'>
          <div className='rounded-full bg-stone-300 h-14 w-14' />
          <div className='text-2xl font-bold mx-auto relative'>
            Anglish Thesaurus
          </div>
        </div>
        <Suggest />
      </div>
      <div className='flex flex-col w-full max-w-xl'></div>
    </main>
  );
}
