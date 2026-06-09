import { useState } from "react";
import { changePin } from "../api/authApi";

function ChangePin() {
  const [oldPin, setOldPin] =
    useState("");

  const [newPin, setNewPin] =
    useState("");

  const submit = async (e) => {
    e.preventDefault();

    const res = await changePin({
      oldPin,
      newPin,
    });

    alert(res.data.message);
  };

  return (
    <form onSubmit={submit}>
      <input
        placeholder="Old PIN"
        value={oldPin}
        onChange={(e) =>
          setOldPin(e.target.value)
        }
      />

      <input
        placeholder="New PIN"
        value={newPin}
        onChange={(e) =>
          setNewPin(e.target.value)
        }
      />

      <button>
        Change PIN
      </button>
    </form>
  );
}

export default ChangePin;