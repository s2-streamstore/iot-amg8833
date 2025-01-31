import AMG8833 from "./Monitor";

export default function Home() {

  return (
    <div className="items-center justify-items-center min-h-screen  sm:p-10">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div className="p-4 border border-gray-300 rounded-lg overflow-auto max-h-126">
          <AMG8833 />
        </div>
      </main>
    </div>
  );
}