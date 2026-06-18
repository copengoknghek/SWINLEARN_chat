export type CourseUnit = {
  code: string
  title: string
  level: 'Foundation' | 'Intermediate' | 'Advanced'
  duration: string
  overview: string
  review: string
  details: string[]
}

export type ChildMajor = {
  id: string
  title: string
  tagline: string
  description: string
  topics: string[]
  pathways: string[]
  courses: CourseUnit[]
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
        courses: [
          {
            code: 'COS30019',
            title: 'Introduction to Artificial Intelligence',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Explore search, reasoning, learning models, and practical AI problem solving.',
            review: 'A strong overview course for students who want to understand how AI systems make decisions before specialising.',
            details: ['Build small intelligent agents', 'Compare supervised and unsupervised learning', 'Evaluate model accuracy and bias'],
          },
          {
            code: 'COS30018',
            title: 'Intelligent Systems Studio',
            level: 'Advanced',
            duration: '12 weeks',
            overview: 'Apply AI methods to a studio project using data, models, and iterative evaluation.',
            review: 'Best suited to confident programmers who enjoy testing ideas quickly and explaining technical trade-offs.',
            details: ['Prototype a model-backed application', 'Document training choices', 'Present findings to a mixed audience'],
          },
        ],
      },
      {
        id: 'cyber-security',
        title: 'Cyber Security',
        tagline: 'Protect systems, networks, and digital services from modern threats.',
        description:
          'Cyber Security covers secure system design, ethical hacking, digital forensics, risk management, and incident response. Students build the technical and analytical skills needed to defend real-world platforms.',
        topics: ['Network security', 'Ethical hacking', 'Digital forensics', 'Risk management'],
        pathways: ['Security analyst', 'Penetration tester', 'Cyber risk consultant'],
        courses: [
          {
            code: 'CYB10001',
            title: 'Cyber Security Principles',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Learn the security mindset through threats, controls, identity, access, and incident response basics.',
            review: 'A practical first cyber course with clear links between theory and everyday platform security.',
            details: ['Map common attack paths', 'Review access controls', 'Write an incident response summary'],
          },
          {
            code: 'TNE10006',
            title: 'Networks and Switching',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Study routing, switching, addressing, and the network foundations behind secure systems.',
            review: 'Valuable for cyber students because it makes later security testing and traffic analysis much easier.',
            details: ['Configure network topologies', 'Trace packet flow', 'Explain routing and switching decisions'],
          },
        ],
      },
      {
        id: 'software-development',
        title: 'Software Development',
        tagline: 'Design, build, test, and maintain reliable software products.',
        description:
          'Software Development develops practical engineering skills across web, mobile, backend, cloud, and team-based delivery. Students work with modern programming practices and learn to ship maintainable applications.',
        topics: ['Web applications', 'Mobile apps', 'Cloud services', 'Agile delivery'],
        pathways: ['Software developer', 'Full-stack engineer', 'Mobile app developer'],
        courses: [
          {
            code: 'COS10009',
            title: 'Introduction to Programming',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Build programming foundations with variables, control flow, functions, collections, and debugging.',
            review: 'The best starting point for new developers because it rewards steady practice and clear problem decomposition.',
            details: ['Solve small programming tasks', 'Use functions and data structures', 'Debug and test code'],
          },
          {
            code: 'COS10011',
            title: 'Creating Web Applications',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Create browser-based interfaces with HTML, CSS, JavaScript, forms, and simple integration patterns.',
            review: 'A hands-on course that gives students visible progress quickly and prepares them for interface development.',
            details: ['Build responsive pages', 'Handle user input', 'Connect frontend structure with behaviour'],
          },
        ],
      },
      {
        id: 'data-science',
        title: 'Data Science',
        tagline: 'Turn data into insight through analytics, statistics, and visualization.',
        description:
          'Data Science combines programming, statistics, databases, and visual communication. Students learn how to prepare data, uncover patterns, build predictive models, and explain findings clearly.',
        topics: ['Data analytics', 'Statistics', 'Data visualization', 'Predictive modelling'],
        pathways: ['Data scientist', 'Business analyst', 'Analytics engineer'],
        courses: [
          {
            code: 'DAT10001',
            title: 'Data Analytics Foundations',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Clean, explore, and summarise datasets using practical analysis workflows.',
            review: 'A friendly entry point for students who like evidence-based decisions and visual explanations.',
            details: ['Prepare messy data', 'Find patterns with descriptive statistics', 'Create clear charts and summaries'],
          },
          {
            code: 'COS20015',
            title: 'Applied Statistics for Computing',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Use statistical methods to test assumptions, interpret uncertainty, and support predictive models.',
            review: 'Challenging in a good way; the course becomes useful whenever data needs a defensible conclusion.',
            details: ['Use probability distributions', 'Run hypothesis tests', 'Interpret confidence and error'],
          },
        ],
      },
      {
        id: 'games-development',
        title: 'Games Development',
        tagline: 'Build playable experiences with game engines, interaction design, and real-time systems.',
        description:
          'Games Development explores gameplay programming, graphics, game engines, interactive storytelling, and production pipelines. Students learn to prototype, test, and polish digital games.',
        topics: ['Gameplay programming', 'Game engines', 'Interactive design', '3D graphics'],
        pathways: ['Game developer', 'Technical designer', 'Gameplay programmer'],
        courses: [
          {
            code: 'GAM10001',
            title: 'Game Design Studio',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Design mechanics, levels, feedback loops, and prototypes for playable digital experiences.',
            review: 'Great for students who want to learn why a game feels good before focusing on code-heavy systems.',
            details: ['Prototype mechanics', 'Playtest interaction loops', 'Document design decisions'],
          },
          {
            code: 'COS30031',
            title: 'Games Programming',
            level: 'Advanced',
            duration: '12 weeks',
            overview: 'Build gameplay systems with real-time input, physics, rendering, and engine workflows.',
            review: 'A demanding technical course for students who enjoy performance, iteration, and visible results.',
            details: ['Implement game systems', 'Work with engine tools', 'Tune performance and responsiveness'],
          },
        ],
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
        courses: [
          {
            code: 'BUS10012',
            title: 'Business Data Analysis',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Use data to define business problems, compare options, and communicate evidence.',
            review: 'A useful bridge between business judgement and data work, especially for students new to analytics.',
            details: ['Frame measurable questions', 'Analyse trends', 'Recommend evidence-backed actions'],
          },
          {
            code: 'INF20011',
            title: 'Dashboards and Decisions',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Design dashboard views that support operational, customer, and management decisions.',
            review: 'Practical and portfolio-friendly because the final work is easy to show to employers.',
            details: ['Create KPI structures', 'Design dashboard layouts', 'Explain insights to stakeholders'],
          },
        ],
      },
      {
        id: 'marketing',
        title: 'Marketing',
        tagline: 'Plan campaigns, understand audiences, and grow brand value.',
        description:
          'Marketing covers consumer behaviour, digital campaigns, brand strategy, market research, and performance measurement. Students learn to shape messages that reach the right audience.',
        topics: ['Consumer behaviour', 'Brand strategy', 'Digital campaigns', 'Market research'],
        pathways: ['Marketing coordinator', 'Brand strategist', 'Digital marketer'],
        courses: [
          {
            code: 'MKT10007',
            title: 'Marketing Principles',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Study audiences, positioning, channels, and the foundations of campaign planning.',
            review: 'A clear starting point for students who want to understand how brands earn attention and trust.',
            details: ['Segment audiences', 'Define value propositions', 'Compare channel strategies'],
          },
          {
            code: 'MKT20021',
            title: 'Digital Campaign Studio',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Plan, prototype, and evaluate digital campaigns across social, search, content, and email.',
            review: 'Strong for students who like creative work with measurable outcomes and fast feedback.',
            details: ['Plan a campaign funnel', 'Write platform-ready content', 'Review performance metrics'],
          },
        ],
      },
      {
        id: 'international-business',
        title: 'International Business',
        tagline: 'Understand global markets, trade, and cross-cultural business practice.',
        description:
          'International Business focuses on global strategy, international trade, supply chains, and managing across cultures. Students learn how organizations operate in complex global environments.',
        topics: ['Global strategy', 'Trade systems', 'Cross-cultural management', 'Supply chains'],
        pathways: ['International business officer', 'Trade analyst', 'Global operations coordinator'],
        courses: [
          {
            code: 'BUS20009',
            title: 'Global Business Environments',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Examine global markets, regulation, competition, and the forces shaping international operations.',
            review: 'Helpful for students who enjoy case studies and want a wider view of business decisions.',
            details: ['Compare market conditions', 'Review regional risks', 'Analyse international competitors'],
          },
          {
            code: 'IBS30001',
            title: 'International Trade Practice',
            level: 'Advanced',
            duration: '12 weeks',
            overview: 'Apply trade, logistics, and cross-border planning to realistic business scenarios.',
            review: 'Best for students who want practical exposure to supply chains, trade documents, and global coordination.',
            details: ['Map export workflows', 'Review trade requirements', 'Prepare international operation plans'],
          },
        ],
      },
      {
        id: 'entrepreneurship',
        title: 'Entrepreneurship',
        tagline: 'Develop new ventures from opportunity discovery to launch.',
        description:
          'Entrepreneurship teaches ideation, validation, business models, funding, and growth planning. Students learn how to test ideas and build sustainable venture proposals.',
        topics: ['Business models', 'Startup validation', 'Funding strategy', 'Growth planning'],
        pathways: ['Founder', 'Innovation consultant', 'Venture analyst'],
        courses: [
          {
            code: 'ENT10005',
            title: 'Venture Ideation',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Find opportunities, test assumptions, and shape early venture concepts.',
            review: 'A lively course for students who like ambiguity, customer discovery, and building from scratch.',
            details: ['Identify customer problems', 'Test assumptions quickly', 'Prepare a venture concept'],
          },
          {
            code: 'ENT20014',
            title: 'Startup Launch Lab',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Develop a launch plan with validation, pricing, operations, and growth experiments.',
            review: 'Portfolio-friendly because students leave with a concrete venture plan and sharper pitching skills.',
            details: ['Design a minimum viable offer', 'Plan growth experiments', 'Pitch to reviewers'],
          },
        ],
      },
      {
        id: 'project-management',
        title: 'Project Management',
        tagline: 'Coordinate people, scope, budgets, risks, and delivery outcomes.',
        description:
          'Project Management prepares students to plan, monitor, and deliver projects across business and technology settings. The focus is on practical control, stakeholder communication, and risk handling.',
        topics: ['Project planning', 'Risk control', 'Stakeholder management', 'Delivery methods'],
        pathways: ['Project coordinator', 'Scrum master', 'Delivery manager'],
        courses: [
          {
            code: 'PRM10001',
            title: 'Project Planning Essentials',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Learn scope, timelines, budgets, roles, and the planning language used by delivery teams.',
            review: 'A grounded course that suits students who like structure, coordination, and visible progress.',
            details: ['Create project plans', 'Estimate scope and effort', 'Track milestones and dependencies'],
          },
          {
            code: 'PRM30002',
            title: 'Agile Delivery and Risk',
            level: 'Advanced',
            duration: '12 weeks',
            overview: 'Use agile delivery practices while managing risk, stakeholders, and changing project conditions.',
            review: 'Useful for students aiming for team lead, scrum master, or delivery roles after graduation.',
            details: ['Run delivery ceremonies', 'Manage project risks', 'Communicate trade-offs to stakeholders'],
          },
        ],
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
        courses: [
          {
            code: 'DDM10001',
            title: 'Digital Content Studio',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Produce platform-ready digital content with planning, editing, publishing, and reflection.',
            review: 'A hands-on course with frequent creative output and strong links to real online media work.',
            details: ['Plan content packages', 'Edit digital media assets', 'Review audience fit'],
          },
          {
            code: 'DDM20012',
            title: 'Interactive Media Production',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Create interactive media experiences that combine content, interface, and user engagement.',
            review: 'Good for students who want to blend creative production with web and interaction thinking.',
            details: ['Prototype interactive content', 'Design user flows', 'Test engagement and usability'],
          },
        ],
      },
      {
        id: 'animation',
        title: 'Animation',
        tagline: 'Bring characters, motion, and visual stories to life.',
        description:
          'Animation focuses on 2D and 3D animation, storyboarding, motion principles, and production workflows. Students develop creative and technical skills for screen-based storytelling.',
        topics: ['2D animation', '3D animation', 'Storyboarding', 'Motion design'],
        pathways: ['Animator', 'Motion designer', 'Storyboard artist'],
        courses: [
          {
            code: 'ANI10002',
            title: 'Motion Principles',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Study timing, spacing, staging, and the core principles behind convincing movement.',
            review: 'A satisfying fundamentals course because improvements are visible from one exercise to the next.',
            details: ['Animate short motion studies', 'Apply timing and spacing', 'Review movement clarity'],
          },
          {
            code: 'ANI20008',
            title: '3D Animation Pipeline',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Move through modelling, rigging, animation, lighting, and final output in a 3D workflow.',
            review: 'Demanding but rewarding for students who like technical craft and polished screen outcomes.',
            details: ['Build 3D scene assets', 'Animate rigged objects', 'Render and critique final shots'],
          },
        ],
      },
      {
        id: 'film-television',
        title: 'Film & Television',
        tagline: 'Produce screen stories through writing, shooting, editing, and direction.',
        description:
          'Film & Television covers production planning, cinematography, editing, sound, and screen storytelling. Students learn how to move a concept from script to finished screen work.',
        topics: ['Cinematography', 'Editing', 'Screenwriting', 'Production planning'],
        pathways: ['Video producer', 'Editor', 'Production assistant'],
        courses: [
          {
            code: 'FTV10001',
            title: 'Screen Production',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Plan, shoot, and assemble short screen works with production roles and creative direction.',
            review: 'A collaborative course that quickly shows students how many choices shape a finished scene.',
            details: ['Prepare production plans', 'Capture visual and audio material', 'Edit short screen sequences'],
          },
          {
            code: 'FTV20015',
            title: 'Editing and Sound',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Shape pace, continuity, tone, and sound design for stronger screen storytelling.',
            review: 'Excellent for students who enjoy detail work and want to understand why edits feel invisible or powerful.',
            details: ['Edit narrative sequences', 'Mix dialogue and effects', 'Critique rhythm and continuity'],
          },
        ],
      },
      {
        id: 'graphic-design',
        title: 'Graphic Design',
        tagline: 'Shape visual identities, layouts, and communication systems.',
        description:
          'Graphic Design develops visual communication skills across branding, typography, layout, and digital design. Students learn to solve communication problems through polished visual systems.',
        topics: ['Typography', 'Brand identity', 'Layout design', 'Digital design'],
        pathways: ['Graphic designer', 'Brand designer', 'Digital designer'],
        courses: [
          {
            code: 'GRA10003',
            title: 'Typography and Layout',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Use type, hierarchy, grids, and composition to create clear visual communication.',
            review: 'A core design course that changes how students see posters, interfaces, and documents.',
            details: ['Build typographic systems', 'Apply layout grids', 'Review readability and hierarchy'],
          },
          {
            code: 'GRA20010',
            title: 'Brand Identity Systems',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Develop logos, identity rules, visual assets, and brand applications across channels.',
            review: 'Strong portfolio value because students produce a complete identity system, not just a single mark.',
            details: ['Create brand assets', 'Document identity rules', 'Apply systems across touchpoints'],
          },
        ],
      },
      {
        id: 'creative-writing',
        title: 'Creative Writing',
        tagline: 'Craft stories, scripts, and written work for contemporary audiences.',
        description:
          'Creative Writing develops voice, structure, editing, and genre awareness. Students practice writing across fiction, nonfiction, script, and digital formats.',
        topics: ['Narrative craft', 'Scriptwriting', 'Editing', 'Genre studies'],
        pathways: ['Writer', 'Copywriter', 'Script editor'],
        courses: [
          {
            code: 'WRI10001',
            title: 'Narrative Writing',
            level: 'Foundation',
            duration: '12 weeks',
            overview: 'Practise character, point of view, structure, setting, and revision for short narrative work.',
            review: 'A supportive writing course for students who want feedback, discipline, and stronger story instincts.',
            details: ['Draft short pieces', 'Workshop peer writing', 'Revise for clarity and voice'],
          },
          {
            code: 'WRI20006',
            title: 'Script and Digital Storytelling',
            level: 'Intermediate',
            duration: '12 weeks',
            overview: 'Write scripts and digital narratives shaped for screen, audio, interactive, or online formats.',
            review: 'Useful for writers who want to move beyond prose and understand audience, format, and production needs.',
            details: ['Write script scenes', 'Adapt stories for digital formats', 'Pitch narrative concepts'],
          },
        ],
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
