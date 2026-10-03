import DemoApp from './DemoApp';
import LiveApp from './LiveApp';
import {configured} from './lib/backend';

export default function App() {
  return configured ? <LiveApp/> : <DemoApp/>;
}
