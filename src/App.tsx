import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

function App() {
  const [workoutposts, setworkoutposts] = useState<Array<Schema["PostforWorkout"]["type"]>>([]);

  useEffect(() => {
    client.models.PostforWorkout.observeQuery().subscribe({
      next: (data) => setworkoutposts([...data.items]),
    });
  }, []);

  function createTodo() {
    client.models.PostforWorkout.create({ content: window.prompt("Todo content") });
  }

  return (
    <main>
      <h1>My todos</h1>
      <button onClick={createTodo}>+ new</button>
      <ul>
        {workoutposts.map((PostforWorkout) => (
          <li key={PostforWorkout.id}>{PostforWorkout.content}</li>
        ))}
      </ul>

    </main>
  );
}

export default App;
