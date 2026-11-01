import React from 'react';
import { JarvisHUD } from './components/JarvisHUD';

export const App: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#020c0c]">
      <JarvisHUD />
    </div>
  );
};

export default App;
