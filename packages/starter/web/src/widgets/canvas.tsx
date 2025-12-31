import { mountWidget } from "skybridge/web";

const MyWidget: React.FC = () => {
  return <h1>Canvas</h1>;
};

mountWidget(<MyWidget />);
