/**
 * Ancient Greek mythological names for agent display.
 * Names are drawn from gods, heroes, philosophers, Titans, and legendary figures.
 */
export const AGENT_NAMES: readonly string[] = [
  // Olympian gods
  "Zeus", "Hera", "Poseidon", "Demeter", "Athena", "Apollo", "Artemis",
  "Ares", "Aphrodite", "Hephaestus", "Hermes", "Dionysus",
  // Titans
  "Cronus", "Rhea", "Hyperion", "Themis", "Mnemosyne", "Phoebe",
  "Tethys", "Oceanus", "Coeus", "Crius", "Iapetus",
  // Heroes
  "Achilles", "Heracles", "Odysseus", "Perseus", "Theseus", "Jason",
  "Bellerophon", "Orpheus", "Diomedes", "Acheron", "Patroclus",
  "Ajax", "Agamemnon", "Menelaus", "Leonidas", "Pyrrhus",
  // Demigods and notable mortals
  "Andromeda", "Atalanta", "Ariadne", "Cassandra", "Elektra", "Penelope",
  "Circe", "Medea", "Calypso", "Daphne", "Persephone",
  "Helen", "Iphigenia", "Clytemnestra", "Antigone", "Niobe",
  // Philosophers and thinkers
  "Socrates", "Plato", "Aristotle", "Pythagoras", "Heraclitus",
  "Anaximander", "Parmenides", "Empedocles", "Democritus", "Epicurus",
  "Zeno", "Diogenes", "Thales", "Xenophon", "Archimedes",
  "Euclid", "Hippocrates", "Sophocles", "Euripides", "Aristophanes",
  // Lesser gods and spirits
  "Eros", "Psyche", "Nike", "Tyche", "Nemesis", "Iris", "Eos",
  "Helios", "Selene", "Boreas", "Zephyrus", "Notus", "Eurus",
  "Morpheus", "Hypnos", "Thanatos", "Charon", "Hecate",
  "Eris", "Phobos", "Deimos", "Harmonia", "Ganymede",
  // Muses and arts
  "Calliope", "Clio", "Erato", "Euterpe", "Melpomene",
  "Polyhymnia", "Terpsichore", "Thalia", "Urania",
  // Creatures and legendary figures
  "Daedalus", "Icarus", "Narcissus", "Endymion", "Actaeon",
  "Adonis", "Midas", "Sisyphus", "Tantalus", "Prometheus",
  "Epimetheus", "Atlas", "Proteus", "Triton", "Nereus",
  "Chiron", "Peleus", "Cadmus", "Meleager", "Tydeus",
  // Spartan and Macedonian figures
  "Lysander", "Brasidas", "Epaminondas", "Pausanias", "Alcibiades",
  "Themistocles", "Miltiades", "Cimon", "Pericles", "Solon",
  "Lycurgus", "Draco", "Cleisthenes", "Pittacus", "Periander",
  // Mythological places used as names
  "Elysian", "Hyperborea", "Arcadia", "Olympus", "Eleusis",
  // Additional heroes
  "Glaucus", "Sarpedon", "Hector", "Aeneas", "Priam",
  "Nestor", "Calchas", "Teiresias", "Laertes", "Telemachus",
  "Calypso", "Nausicaa", "Scylla", "Charybdis", "Circe",
  "Polyphemus", "Aeolus", "Laestrygones", "Phaeacians",
  // Nymphs and minor deities
  "Thetis", "Galatea", "Amphitrite", "Nereida", "Dryade",
  "Hamadryad", "Naiad", "Oread", "Hesperide", "Pleiade",
] as const;

/**
 * Returns a deterministic mythological name for the given agent ID.
 * The same agent_id always produces the same name — no randomness on re-render.
 * Occasionally appends a numeric suffix (2–9) for natural variation.
 */
export function getAgentName(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash * 31) + agentId.charCodeAt(i)) >>> 0;
  }
  const name = AGENT_NAMES[hash % AGENT_NAMES.length];
  // ~14% chance of a numeric suffix using a different bit window
  const suffix = (hash >> 8) % 7 === 0 ? `-${((hash >> 4) % 8) + 2}` : "";
  return name + suffix;
}
