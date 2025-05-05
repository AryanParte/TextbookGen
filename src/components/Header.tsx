import { Book } from "lucide-react";

const Header = () => {
  const handleLogoClick = () => {
    window.location.reload();
  };

  return <header className="bg-textbook text-white py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center mb-2">
          <button onClick={handleLogoClick} className="flex items-center hover:opacity-80 transition-opacity">
            <Book className="h-8 w-8 mr-2" />
            <h1 className="text-3xl font-serif font-thin bg-gradient-to-r from-white to-blue-100 text-transparent bg-clip-text">TextbookGen</h1>
          </button>
        </div>
        <p className="text-center text-sm md:text-base opacity-90 max-w-xl mx-auto">
          Generate complete, professional textbooks with AI in seconds
        </p>
      </div>
    </header>;
};
export default Header;
