export type ChildMajor = {
  id: string
  title: string
  tagline: string
  description: string
  topics: string[]
  pathways: string[]
}

export type MajorAccent = 'blue' | 'orange' | 'green'

export type MainMajor = {
  id: string
  title: string
  summary: string
  accent: MajorAccent
  childMajors: ChildMajor[]
}

export const majorDatabase: MainMajor[] = [
  {
    id: 'computer-science',
    title: 'Computer Science',
    summary: 'Programs for building software systems, data products, secure networks, and interactive technology.',
    accent: 'blue',
    childMajors: [
      {
        id: 'artificial-intelligence',
        title: 'Artificial Intelligence',
        tagline: 'Create intelligent systems that can learn, reason, and adapt.',
        description:
          'Artificial Intelligence focuses on machine learning, neural networks, computer vision, and natural language processing. Students learn how to design models, evaluate data, and build systems that support smarter decision-making.',
        topics: ['Machine learning', 'Neural networks', 'Computer vision', 'Natural language processing'],
        pathways: ['AI engineer', 'Machine learning developer', 'Automation specialist'],
      },
      {
        id: 'cyber-security',
        title: 'Cyber Security',
        tagline: 'Protect systems, networks, and digital services from modern threats.',
        description:
          'Cyber Security covers secure system design, ethical hacking, digital forensics, risk management, and incident response. Students build the technical and analytical skills needed to defend real-world platforms.',
        topics: ['Network security', 'Ethical hacking', 'Digital forensics', 'Risk management'],
        pathways: ['Security analyst', 'Penetration tester', 'Cyber risk consultant'],
      },
      {
        id: 'software-development',
        title: 'Software Development',
        tagline: 'Design, build, test, and maintain reliable software products.',
        description:
          'Software Development develops practical engineering skills across web, mobile, backend, cloud, and team-based delivery. Students work with modern programming practices and learn to ship maintainable applications.',
        topics: ['Web applications', 'Mobile apps', 'Cloud services', 'Agile delivery'],
        pathways: ['Software developer', 'Full-stack engineer', 'Mobile app developer'],
      },
      {
        id: 'data-science',
        title: 'Data Science',
        tagline: 'Turn data into insight through analytics, statistics, and visualization.',
        description:
          'Data Science combines programming, statistics, databases, and visual communication. Students learn how to prepare data, uncover patterns, build predictive models, and explain findings clearly.',
        topics: ['Data analytics', 'Statistics', 'Data visualization', 'Predictive modelling'],
        pathways: ['Data scientist', 'Business analyst', 'Analytics engineer'],
      },
      {
        id: 'games-development',
        title: 'Games Development',
        tagline: 'Build playable experiences with game engines, interaction design, and real-time systems.',
        description:
          'Games Development explores gameplay programming, graphics, game engines, interactive storytelling, and production pipelines. Students learn to prototype, test, and polish digital games.',
        topics: ['Gameplay programming', 'Game engines', 'Interactive design', '3D graphics'],
        pathways: ['Game developer', 'Technical designer', 'Gameplay programmer'],
      },
    ],
  },
  {
    id: 'business-management',
    title: 'Business & Management',
    summary: 'Programs for leading teams, managing operations, growing ventures, and making data-informed decisions.',
    accent: 'orange',
    childMajors: [
      {
        id: 'business-analytics',
        title: 'Business Analytics',
        tagline: 'Use data to improve strategy, operations, and customer decisions.',
        description:
          'Business Analytics develops skills in data interpretation, dashboards, forecasting, and decision support. Students learn how to connect business questions with measurable evidence.',
        topics: ['Business intelligence', 'Forecasting', 'Dashboards', 'Decision modelling'],
        pathways: ['Business analyst', 'Insights analyst', 'Operations analyst'],
      },
      {
        id: 'marketing',
        title: 'Marketing',
        tagline: 'Plan campaigns, understand audiences, and grow brand value.',
        description:
          'Marketing covers consumer behaviour, digital campaigns, brand strategy, market research, and performance measurement. Students learn to shape messages that reach the right audience.',
        topics: ['Consumer behaviour', 'Brand strategy', 'Digital campaigns', 'Market research'],
        pathways: ['Marketing coordinator', 'Brand strategist', 'Digital marketer'],
      },
      {
        id: 'international-business',
        title: 'International Business',
        tagline: 'Understand global markets, trade, and cross-cultural business practice.',
        description:
          'International Business focuses on global strategy, international trade, supply chains, and managing across cultures. Students learn how organizations operate in complex global environments.',
        topics: ['Global strategy', 'Trade systems', 'Cross-cultural management', 'Supply chains'],
        pathways: ['International business officer', 'Trade analyst', 'Global operations coordinator'],
      },
      {
        id: 'entrepreneurship',
        title: 'Entrepreneurship',
        tagline: 'Develop new ventures from opportunity discovery to launch.',
        description:
          'Entrepreneurship teaches ideation, validation, business models, funding, and growth planning. Students learn how to test ideas and build sustainable venture proposals.',
        topics: ['Business models', 'Startup validation', 'Funding strategy', 'Growth planning'],
        pathways: ['Founder', 'Innovation consultant', 'Venture analyst'],
      },
      {
        id: 'project-management',
        title: 'Project Management',
        tagline: 'Coordinate people, scope, budgets, risks, and delivery outcomes.',
        description:
          'Project Management prepares students to plan, monitor, and deliver projects across business and technology settings. The focus is on practical control, stakeholder communication, and risk handling.',
        topics: ['Project planning', 'Risk control', 'Stakeholder management', 'Delivery methods'],
        pathways: ['Project coordinator', 'Scrum master', 'Delivery manager'],
      },
    ],
  },
  {
    id: 'media-creative-arts',
    title: 'Media & Creative Arts',
    summary: 'Programs for digital storytelling, production, design, media communication, and creative practice.',
    accent: 'green',
    childMajors: [
      {
        id: 'digital-media',
        title: 'Digital Media',
        tagline: 'Create content and interactive experiences for digital platforms.',
        description:
          'Digital Media blends production, interaction, platform strategy, and audience engagement. Students learn to create media that works across web, social, and emerging digital channels.',
        topics: ['Content production', 'Interactive media', 'Platform strategy', 'Audience engagement'],
        pathways: ['Digital producer', 'Content strategist', 'Social media specialist'],
      },
      {
        id: 'animation',
        title: 'Animation',
        tagline: 'Bring characters, motion, and visual stories to life.',
        description:
          'Animation focuses on 2D and 3D animation, storyboarding, motion principles, and production workflows. Students develop creative and technical skills for screen-based storytelling.',
        topics: ['2D animation', '3D animation', 'Storyboarding', 'Motion design'],
        pathways: ['Animator', 'Motion designer', 'Storyboard artist'],
      },
      {
        id: 'film-television',
        title: 'Film & Television',
        tagline: 'Produce screen stories through writing, shooting, editing, and direction.',
        description:
          'Film & Television covers production planning, cinematography, editing, sound, and screen storytelling. Students learn how to move a concept from script to finished screen work.',
        topics: ['Cinematography', 'Editing', 'Screenwriting', 'Production planning'],
        pathways: ['Video producer', 'Editor', 'Production assistant'],
      },
      {
        id: 'graphic-design',
        title: 'Graphic Design',
        tagline: 'Shape visual identities, layouts, and communication systems.',
        description:
          'Graphic Design develops visual communication skills across branding, typography, layout, and digital design. Students learn to solve communication problems through polished visual systems.',
        topics: ['Typography', 'Brand identity', 'Layout design', 'Digital design'],
        pathways: ['Graphic designer', 'Brand designer', 'Digital designer'],
      },
      {
        id: 'creative-writing',
        title: 'Creative Writing',
        tagline: 'Craft stories, scripts, and written work for contemporary audiences.',
        description:
          'Creative Writing develops voice, structure, editing, and genre awareness. Students practice writing across fiction, nonfiction, script, and digital formats.',
        topics: ['Narrative craft', 'Scriptwriting', 'Editing', 'Genre studies'],
        pathways: ['Writer', 'Copywriter', 'Script editor'],
      },
    ],
  },
]

export function getMainMajorById(majorId: string) {
  return majorDatabase.find((major) => major.id === majorId)
}

export function getChildMajorById(majorId: string, childMajorId: string) {
  return getMainMajorById(majorId)?.childMajors.find((childMajor) => childMajor.id === childMajorId)
}
