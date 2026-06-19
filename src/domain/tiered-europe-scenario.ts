import type { BenefitPill, CapabilityInfo, Tier } from './tiered-europe';

// ─── tier data ────────────────────────────────────────────────────────────────

export const tiers: Tier[] = [
  {
    id: "inner",
    order: 1,
    title: "Inner Union",
    shortTitle: "Inner Union",
    tone: "navy",
    summary:
      "A frontrunner group for common defence, eurozone depth, Schengen, and unified foreign policy.",
    capabilities: ["Foreign policy", "Common defence", "Eurozone", "Schengen"],
    directCountries: [
      ["276", "DE", "Germany"],
      ["250", "FR", "France"],
      ["380", "IT", "Italy"],
      ["724", "ES", "Spain"],
      ["528", "NL", "Netherlands"],
      ["616", "PL", "Poland"],
    ],
  },
  {
    id: "eu",
    order: 2,
    title: "European Union",
    shortTitle: "European Union",
    tone: "teal",
    summary:
      "The shared rights and obligations of membership: institutions, budget, law, and the single market.",
    capabilities: ["Single market", "EU budget", "EU law", "Representation"],
    directCountries: [
      ["040", "AT", "Austria"],
      ["056", "BE", "Belgium"],
      ["100", "BG", "Bulgaria"],
      ["191", "HR", "Croatia"],
      ["196", "CY", "Cyprus"],
      ["203", "CZ", "Czechia"],
      ["208", "DK", "Denmark"],
      ["233", "EE", "Estonia"],
      ["246", "FI", "Finland"],
      ["300", "GR", "Greece"],
      ["348", "HU", "Hungary"],
      ["372", "IE", "Ireland"],
      ["428", "LV", "Latvia"],
      ["440", "LT", "Lithuania"],
      ["442", "LU", "Luxembourg"],
      ["470", "MT", "Malta"],
      ["620", "PT", "Portugal"],
      ["642", "RO", "Romania"],
      ["703", "SK", "Slovakia"],
      ["705", "SI", "Slovenia"],
      ["752", "SE", "Sweden"],
    ],
  },
  {
    id: "associate",
    order: 3,
    title: "Associate Membership",
    shortTitle: "Associate",
    tone: "sand",
    summary:
      "A bridge tier for candidates, close neighbours, and partners aligned with the single market path.",
    capabilities: ["Single market access", "Customs alignment", "Budget path", "Rule of law"],
    directCountries: [
      ["804", "UA", "Ukraine"],
      ["498", "MD", "Moldova"],
      ["268", "GE", "Georgia"],
      ["008", "AL", "Albania"],
      ["070", "BA", "Bosnia and Herzegovina"],
      ["499", "ME", "Montenegro"],
      ["688", "RS", "Serbia"],
      ["807", "MK", "North Macedonia"],
      ["Kosovo", "XK", "Kosovo"],
      ["792", "TR", "Turkey"],
      ["578", "NO", "Norway"],
      ["352", "IS", "Iceland"],
      ["234", "FO", "Faroe Islands"],
      ["304", "GL", "Greenland"],
      ["756", "CH", "Switzerland"],
      ["826", "UK", "United Kingdom"],
    ],
  },
  {
    id: "friends",
    order: 4,
    title: "European Community + Friends",
    shortTitle: "Community + Friends",
    tone: "cream",
    summary:
      "A wider democratic circle for security, climate, energy, crises, and supply chains.",
    capabilities: ["Security", "Climate policy", "Energy", "Crisis response"],
    directCountries: [
      ["124", "CA", "Canada"],
      ["036", "AU", "Australia"],
      ["392", "JP", "Japan"],
      ["410", "KR", "South Korea"],
      ["554", "NZ", "New Zealand"],
    ],
  },
];

// ─── benefit pills data ───────────────────────────────────────────────────────

export const benefitPills: BenefitPill[] = [
  {
    id: "open-doors",
    title: "Open doors",
    shortText: "Progress before full membership",
    tooltip:
      "Not yet a member should not mean standing still. Associate membership could give candidate countries and close partners a visible way to move closer before full accession is complete.",
    modalTitle: "Make progress visible before full EU membership.",
    modalBody:
      "EU accession can take many years. A tiered model could give countries a recognised place on the European path while reforms, negotiations, and political decisions continue. This could include gradual alignment with EU rules, closer market access, customs cooperation, funding pathways, institutional preparation, and rule-of-law milestones.",
    keyIdea:
      "Countries should not be left in a vague waiting room. They should be able to show real progress, build trust, and move step by step toward deeper integration.",
    caveat:
      "This should not replace full membership for countries that qualify. It should make the road toward membership clearer and more useful.",
  },
  {
    id: "shared-standards",
    title: "Shared standards",
    shortText: "One foundation of values",
    tooltip:
      "Different tiers should not mean different values. Every closer circle should remain anchored in democracy, rule of law, human rights, and legal reliability.",
    modalTitle: "A tiered Europe still needs a common foundation.",
    modalBody:
      "A tiered model only works if the circles are connected by shared democratic and legal standards. Countries may cooperate at different depths, but the direction should remain the same.",
    keyIdea:
      "Flexibility should not become a loophole. Moving closer should require stronger alignment with the EU\u2019s values and legal order.",
    caveat:
      "Without shared standards, the tiers become purely transactional. With shared standards, they become a credible path toward trust, stability, and deeper cooperation.",
  },
  {
    id: "strategic-weight",
    title: "Strategic weight",
    shortText: "More reach with trusted partners",
    tooltip:
      "Europe can act with more weight when it cooperates beyond its borders. Security, energy, climate, supply chains, and crisis response often need partners outside the EU itself.",
    modalTitle: "Some challenges are bigger than the EU\u2019s borders.",
    modalBody:
      "A tiered Europe could make it easier to cooperate with democratic partners on issues where geography, security, trade, technology, and energy are already connected.",
    keyIdea:
      "Not every partnership needs to be a membership promise. Some countries may never join the EU, but they can still be important democratic partners.",
    caveat:
      "This outer circle should be about practical cooperation, not pretending that all partners are on the same membership path.",
  },
  {
    id: "forward-motion",
    title: "Forward motion",
    shortText: "A path inward over time",
    tooltip:
      "Tiers should be paths, not permanent labels. Countries should be able to move inward as reforms, capacity, trust, and public support grow.",
    modalTitle: "A tiered Europe should behave like a ladder.",
    modalBody:
      "The purpose of tiers is not to freeze countries into fixed categories. The purpose is to make movement possible.",
    keyIdea:
      "The map should show direction, not destiny. Tiers are useful only if countries can move closer when they are ready.",
    caveat:
      "Movement inward should not be automatic. It should depend on real reforms, mutual trust, legal alignment, and public consent.",
  },
];

// Self-authored icons; distributed under the project's MIT license.
export const benefitIconSvgById: Record<string, string> = {
  "open-doors": `
    <svg class="pill-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 21h10V5.2L9 3.4v17.6" />
      <path d="M17 21h2" />
      <path d="M11.7 12.2h.1" />
    </svg>
  `,
  "shared-standards": `
    <svg class="pill-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.3 5.7 5.8v5.4c0 4.1 2.4 7.4 6.3 9.2 3.9-1.8 6.3-5.1 6.3-9.2V5.8L12 3.3Z" />
      <path d="m8.4 12.3 2.2 2.2 5-5.2" />
    </svg>
  `,
  "strategic-weight": `
    <svg class="pill-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.4" />
      <path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4 5.4-2.2Z" />
      <path d="M12 3.6v2" />
      <path d="M12 18.4v2" />
    </svg>
  `,
  "forward-motion": `
    <svg class="pill-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.2 16.8h4.4c4.5 0 7.5-2.6 8.9-7.1" />
      <path d="M14.1 8.9h4.6v4.6" />
      <path d="M5.1 8.3h5.4" />
    </svg>
  `,
};

// ─── capability info data ─────────────────────────────────────────────────────

export const capabilityInfoList: CapabilityInfo[] = [
  // ── friends ──
  {
    label: "Security",
    tooltip:
      "Democratic partners can coordinate on shared security threats, intelligence, and resilience without full EU membership.",
    modalTitle: "Security cooperation beyond EU borders.",
    modalBody:
      "Security threats — hybrid attacks, disinformation, energy disruption, and regional conflicts — do not stop at EU borders. A wider democratic circle can coordinate responses, share intelligence, align sanctions policy, and build collective resilience. This gives both the EU and its partners more reach.",
    keyIdea:
      "Partners who share values can act together on security even from outside the EU structure.",
    caveat:
      "Outer-tier security cooperation is distinct from a common EU defence, which requires deeper integration and belongs to the inner circle.",
  },
  {
    label: "Climate\u00a0policy",
    tooltip:
      "Climate action is stronger when democratic partners beyond the EU coordinate on targets, standards, and transition costs.",
    modalTitle: "Climate cooperation works better at a wider scale.",
    modalBody:
      "Carbon pricing, clean energy investment, supply chain standards, and climate resilience all benefit from coordination across borders. A wider tier of partners aligned on climate goals can act with more collective weight — and avoid carbon leakage caused by diverging standards.",
    keyIdea:
      "Climate is a shared problem. Connecting democratic partners on climate policy gives Europe more influence and coherence.",
    caveat:
      "Outer-tier partners can align on outcomes and targets without being subject to EU climate legislation directly.",
  },
  {
    label: "Energy",
    tooltip:
      "Energy security across Europe depends on interconnected grids, diversified supply, and trusted partners beyond EU borders.",
    modalTitle: "Energy security needs a wider network.",
    modalBody:
      "A reliable energy supply depends on infrastructure, diversification, and cooperation that reaches well beyond current EU members. Outer-tier partners can be part of coordinated energy planning, grid integration, and supply agreements — reducing dependence on single sources and increasing collective resilience.",
    keyIdea:
      "Energy independence for Europe is stronger when more democratic partners are part of the shared network.",
    caveat:
      "Full energy market integration — with common rules, shared pricing, and regulatory alignment — is deeper than what this outer tier implies.",
  },
  {
    label: "Crisis\u00a0response",
    tooltip:
      "Crises rarely respect borders. A wider circle of coordinated partners helps Europe respond to health, climate, and security emergencies faster.",
    modalTitle: "Coordinated crisis response reaches further.",
    modalBody:
      "A pandemic, a regional conflict, a climate disaster, or a financial shock can spill across continents. Outer-tier partners who coordinate on emergency preparedness, supply chain resilience, mutual assistance, and information sharing can help Europe and its partners respond more effectively when it matters most.",
    keyIdea:
      "A wider democratic circle is more resilient. Partners who share values and communication channels respond better together.",
    caveat:
      "Effective crisis coordination requires trust, transparency, and compatible systems — not formal membership, but genuine commitment.",
  },
  // ── associate ──
  {
    label: "Single\u00a0market\u00a0access",
    tooltip:
      "Associate members could participate in parts of the single market before full EU membership is settled.",
    modalTitle: "Market access as a bridge to full integration.",
    modalBody:
      "Full EU single market membership comes with obligations — common rules, regulatory alignment, court oversight, and financial contributions. Associate membership could offer staged or partial access, giving countries and businesses more certainty while the accession path continues. This keeps economic momentum alive during long political processes.",
    keyIdea:
      "Economic integration should not wait for political decisions that may take years. Staged market access keeps the path moving.",
    caveat:
      "Partial access without full obligations can create uneven conditions. The terms need to be clear, reciprocal, and tied to real progress.",
  },
  {
    label: "Customs\u00a0alignment",
    tooltip:
      "Aligning with EU customs rules reduces trade friction and signals regulatory commitment on the accession path.",
    modalTitle: "Customs alignment opens the trading relationship.",
    modalBody:
      "When a country aligns its customs procedures, tariff schedules, and border management with EU standards, it reduces trade barriers, simplifies supply chains, and signals regulatory seriousness. For associate-path countries, customs alignment can come well before full single market membership and delivers real economic benefits quickly.",
    keyIdea:
      "Customs alignment is one of the most practical early steps toward economic integration — visible, measurable, and mutually beneficial.",
    caveat:
      "Alignment without membership means accepting EU trade rules without a voice in setting them. Accession is ultimately meant to resolve that asymmetry.",
  },
  {
    label: "Budget\u00a0path",
    tooltip:
      "Associate members could access EU funding streams tied to reforms, infrastructure, and rule-of-law progress.",
    modalTitle: "Funding tied to progress, not just membership.",
    modalBody:
      "EU cohesion funds, structural funds, and investment programmes are powerful tools for reform and development. An associate membership tier could open pathways to some of these resources, tied to measurable milestones rather than waiting for full accession. This makes the reform journey financially supported, not just aspirational.",
    keyIdea:
      "Countries should not have to wait for full membership to benefit from EU investment that supports the reforms they are already making.",
    caveat:
      "Budget access without full budget obligations requires careful design to maintain fairness for full members and avoid creating permanent half-memberships.",
  },
  {
    label: "Rule\u00a0of\u00a0law",
    tooltip:
      "Rule-of-law alignment is both a condition for moving closer and a genuine benefit of closer ties with the EU.",
    modalTitle: "Rule of law as the gate and the prize.",
    modalBody:
      "Independent courts, anti-corruption standards, free media, and transparent public administration are not just requirements for EU membership — they are the foundations that make deeper integration trustworthy. For associate-path countries, rule-of-law progress should unlock closer access, not just satisfy a checklist.",
    keyIdea:
      "Rule of law is the shared foundation that makes every tier of integration credible. Real progress here should open real doors.",
    caveat:
      "Rule-of-law benchmarks must be genuine and measurable — not a moveable goalpost or a tool for indefinite delay.",
  },
  // ── eu ──
  {
    label: "Single\u00a0market",
    tooltip:
      "The single market gives EU members a seamless space for goods, services, capital, and people — one of the most integrated economic areas in the world.",
    modalTitle: "The single market is the EU\u2019s core economic achievement.",
    modalBody:
      "The four freedoms — free movement of goods, services, capital, and people — give EU members access to a market of hundreds of millions with no internal tariffs or regulatory barriers. For businesses, workers, and consumers, it is the most tangible daily benefit of EU membership. It requires common rules, shared enforcement, and a common court to function.",
    keyIdea:
      "The single market is not just a trade zone. It is a shared regulatory and legal space that requires collective commitment to maintain.",
    caveat:
      "Countries in outer tiers can access parts of the single market but not all of it. Full participation requires full obligations.",
  },
  {
    label: "EU\u00a0budget",
    tooltip:
      "Full EU members contribute to and benefit from a shared budget covering agriculture, cohesion, research, and crisis response.",
    modalTitle: "A shared budget funds shared priorities.",
    modalBody:
      "The EU budget funds cohesion policy for less-developed regions, agricultural support, research and innovation programmes, infrastructure investment, and crisis response. Full members contribute based on their economic size and draw based on agreed priorities. The budget is a key expression of solidarity and a driver of long-term convergence.",
    keyIdea:
      "Shared budget means shared responsibility. Full members have obligations and entitlements that reflect their commitment to the common project.",
    caveat:
      "Budget negotiations are politically difficult. Net contributor and net recipient countries have different interests, which creates recurring tensions inside the EU.",
  },
  {
    label: "EU\u00a0law",
    tooltip:
      "EU law is directly binding on all member states and takes precedence over national law in areas of EU competence.",
    modalTitle: "EU law creates a shared legal order.",
    modalBody:
      "EU regulations apply directly and uniformly in all member states. EU directives must be transposed into national law within set deadlines. The Court of Justice of the EU is the final authority on EU law. This shared legal order is what makes the single market and other EU commitments enforceable and reliable rather than voluntary.",
    keyIdea:
      "EU law is what turns political commitments into enforceable obligations. Without it, the EU would be a club of promises rather than a functioning legal space.",
    caveat:
      "EU law limits national autonomy in areas of EU competence. This is a deliberate trade-off — pooling sovereignty to create a reliable and predictable common space.",
  },
  {
    label: "Representation",
    tooltip:
      "Full EU members have seats and votes in the European Parliament, the Council, the Commission, and the EU courts.",
    modalTitle: "Representation means a seat at the table.",
    modalBody:
      "Full EU members send elected MEPs to the European Parliament, ministers to the Council, a Commissioner to the Commission, and judges to the Court of Justice. They participate in setting the rules they must follow. This political dimension — not just obligations but democratic ownership — is the core of what makes EU membership different from any other international arrangement.",
    keyIdea:
      "You cannot have the obligations of EU law without the right to shape those rules. Representation and integration are inseparable.",
    caveat:
      "Countries in outer tiers accept EU-aligned rules without full votes in making them. This democratic asymmetry is one of the strongest arguments for accession over permanent partial membership.",
  },
  // ── inner ──
  {
    label: "Foreign\u00a0policy",
    tooltip:
      "Inner Union members could move toward a unified foreign policy — speaking with a single voice on major global issues.",
    modalTitle: "A common foreign policy gives Europe strategic weight.",
    modalBody:
      "Today, EU foreign policy is often constrained by unanimity requirements and divergent national interests. A frontrunner group of willing states could move toward qualified majority voting on foreign policy, a common diplomatic service with real authority, coordinated positions at the UN and other multilateral bodies, and unified responses to major global events.",
    keyIdea:
      "Europe\u2019s influence in the world grows when its member states speak with one voice rather than many competing ones.",
    caveat:
      "Foreign policy is closely tied to national identity and historical relationships. Deeper integration here requires sustained political trust and a genuine shift in how governments see shared interests.",
  },
  {
    label: "Common\u00a0defence",
    tooltip:
      "A frontrunner group could develop genuine common defence capabilities, command structures, and joint procurement.",
    modalTitle: "Common defence is more than coordination.",
    modalBody:
      "A real common defence goes beyond sharing intelligence or running joint exercises. It means common command structures, pooled procurement and industrial capacity, mutual defence guarantees, joint operational planning, and a shared budget for military capability. This is the most integrated form of European security cooperation.",
    keyIdea:
      "Genuine common defence capacity would give Europe the ability to act — and deter — without depending entirely on US or NATO leadership.",
    caveat:
      "Common defence requires profound political trust and democratic accountability. It must be designed to complement NATO commitments, not create confusion about obligations and command.",
  },
  {
    label: "Eurozone",
    tooltip:
      "Sharing a currency deepens economic integration and requires close fiscal and monetary coordination between members.",
    modalTitle: "The eurozone is the EU\u2019s deepest economic integration.",
    modalBody:
      "Countries in the eurozone share a currency, a central bank, and increasingly common fiscal rules. Monetary policy is set collectively. Exchange rate risk disappears for internal trade. For the eurozone to function well, members need aligned economic structures, a shared fiscal backstop, robust crisis mechanisms, and genuine political commitment to the common currency project.",
    keyIdea:
      "Sharing a currency means sharing economic fate. It requires — and reinforces — closer integration across fiscal, regulatory, and political dimensions.",
    caveat:
      "Eurozone membership removes a key tool of economic adjustment — the exchange rate. It works best when members have strong institutions, aligned economic cycles, and genuine solidarity mechanisms.",
  },
  {
    label: "Schengen",
    tooltip:
      "The Schengen area removes border checks between members, making free movement a lived experience rather than just a legal right.",
    modalTitle: "Schengen makes borders invisible for people.",
    modalBody:
      "Within the Schengen area, people can cross borders between participating countries without passport checks. This is one of the most tangible expressions of European integration — free movement not just as a legal principle but as a daily reality for hundreds of millions of people living, working, and travelling across the continent.",
    keyIdea:
      "Schengen makes Europe feel like a single space. It requires deep trust in each member\u2019s border management, identity systems, and internal security.",
    caveat:
      "Schengen requires robust external border management and cooperation on internal security. It can come under pressure during migration crises, and temporary reintroduction of border checks has occurred.",
  },
];

export const capabilityInfoByLabel = new Map<string, CapabilityInfo>(
  capabilityInfoList.map((c) => [c.label.replace(/\u00a0/g, " "), c]),
);
