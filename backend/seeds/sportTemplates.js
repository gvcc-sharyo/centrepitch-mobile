const sportTemplatesData = [
  // ========================================
  // TEAM SPORTS
  // ========================================
  {
    sportName: 'Cricket',
    sportSlug: 'cricket',
    category: 'team_sports',
    fields: [
      { key: 'pitchType', label: 'Pitch Type', type: 'select', options: ['Turf', 'Mat', 'Concrete', 'Synthetic'], required: true },
      { key: 'boundarySize', label: 'Boundary Size', type: 'number', unit: 'meters', required: false },
      { key: 'practiceNets', label: 'Practice Nets Available', type: 'checkbox', required: false },
      { key: 'bowlingMachine', label: 'Bowling Machine', type: 'checkbox', required: false },
      { key: 'sightScreen', label: 'Sight Screen', type: 'checkbox', required: false },
      { key: 'floodlights', label: 'Floodlights', type: 'checkbox', required: false },
      { key: 'pavilion', label: 'Pavilion/Seating', type: 'checkbox', required: false },
      { key: 'scoreboard', label: 'Scoreboard', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Football',
    sportSlug: 'football',
    category: 'team_sports',
    fields: [
      { key: 'grassType', label: 'Grass Type', type: 'select', options: ['Natural', 'Artificial Turf', 'Hybrid'], required: true },
      { key: 'fieldSize', label: 'Field Size', type: 'select', options: ['Full Size', '7-a-side', '5-a-side', '6-a-side'], required: true },
      { key: 'goalPosts', label: 'Goal Posts', type: 'select', options: ['Fixed', 'Portable'], required: true },
      { key: 'markingLines', label: 'Marking Lines', type: 'checkbox', required: false },
      { key: 'cornerFlags', label: 'Corner Flags', type: 'checkbox', required: false },
      { key: 'dugout', label: 'Dugout/Bench', type: 'checkbox', required: false },
      { key: 'floodlights', label: 'Floodlights', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Basketball',
    sportSlug: 'basketball',
    category: 'team_sports',
    fields: [
      { key: 'courtSize', label: 'Court Size', type: 'select', options: ['Full Court', 'Half Court'], required: true },
      { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Hardwood', 'Concrete', 'Synthetic', 'Outdoor Asphalt'], required: true },
      { key: 'hoopType', label: 'Hoop Type', type: 'select', options: ['Fixed', 'Adjustable Height'], required: true },
      { key: 'backboardMaterial', label: 'Backboard Material', type: 'select', options: ['Glass', 'Acrylic', 'Polycarbonate', 'Steel'], required: false },
      { key: 'threePointLine', label: '3-Point Line Marked', type: 'checkbox', required: false },
      { key: 'scoreboard', label: 'Scoreboard', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Volleyball',
    sportSlug: 'volleyball',
    category: 'team_sports',
    fields: [
      { key: 'courtType', label: 'Court Type', type: 'select', options: ['Indoor', 'Beach', 'Grass'], required: true },
      { key: 'netHeightAdjustable', label: 'Net Height Adjustable', type: 'checkbox', required: false },
      { key: 'antennaMarkers', label: 'Antenna Markers', type: 'checkbox', required: false },
      { key: 'sandDepth', label: 'Sand Depth (Beach)', type: 'number', unit: 'inches', required: false },
      { key: 'refereeStand', label: 'Referee Stand', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false },
      { key: 'lineMarkers', label: 'Line Markers', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Hockey',
    sportSlug: 'hockey',
    category: 'team_sports',
    fields: [
      { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Artificial Turf', 'Natural Grass', 'Astroturf', 'Water-Based Turf'], required: true },
      { key: 'waterBasedTurf', label: 'Water-Based Turf', type: 'checkbox', required: false },
      { key: 'goalPosts', label: 'Goal Posts', type: 'select', options: ['Regulation', 'Practice'], required: true },
      { key: 'shootingCircle', label: 'Shooting Circle Marked', type: 'checkbox', required: false },
      { key: 'dugout', label: 'Dugout', type: 'checkbox', required: false },
      { key: 'sticksProvided', label: 'Sticks Provided', type: 'checkbox', required: false },
      { key: 'floodlights', label: 'Floodlights', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Rugby',
    sportSlug: 'rugby',
    category: 'team_sports',
    fields: [
      { key: 'fieldType', label: 'Field Type', type: 'select', options: ['15s', '7s', 'Touch Rugby', 'League'], required: true },
      { key: 'grassType', label: 'Grass Type', type: 'select', options: ['Natural', 'Artificial', 'Hybrid'], required: true },
      { key: 'goalPosts', label: 'Goal Posts', type: 'select', options: ['H-Posts Fixed', 'Portable'], required: true },
      { key: 'inGoalArea', label: 'In-Goal Area', type: 'checkbox', required: true },
      { key: 'paddingOnPosts', label: 'Padding on Posts', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false },
      { key: 'floodlights', label: 'Floodlights', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Baseball',
    sportSlug: 'baseball',
    category: 'team_sports',
    fields: [
      { key: 'fieldSize', label: 'Field Size', type: 'select', options: ['Regulation', 'Little League', 'Softball'], required: true },
      { key: 'infieldSurface', label: 'Infield Surface', type: 'select', options: ['Dirt', 'Clay', 'Turf'], required: true },
      { key: 'outfieldSurface', label: 'Outfield Surface', type: 'select', options: ['Natural Grass', 'Artificial'], required: true },
      { key: 'battingCage', label: 'Batting Cage', type: 'checkbox', required: false },
      { key: 'dugouts', label: 'Dugouts', type: 'checkbox', required: false },
      { key: 'pitchingMound', label: 'Pitching Mound', type: 'checkbox', required: true },
      { key: 'backstop', label: 'Backstop', type: 'checkbox', required: true },
      { key: 'scoreboard', label: 'Scoreboard', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Softball',
    sportSlug: 'softball',
    category: 'team_sports',
    fields: [
      { key: 'fieldSize', label: 'Field Size', type: 'select', options: ['Fastpitch', 'Slowpitch', 'Modified'], required: true },
      { key: 'infieldSurface', label: 'Infield Surface', type: 'select', options: ['Dirt', 'Clay', 'Turf'], required: true },
      { key: 'outfieldSurface', label: 'Outfield Surface', type: 'select', options: ['Natural Grass', 'Artificial'], required: true },
      { key: 'battingCage', label: 'Batting Cage', type: 'checkbox', required: false },
      { key: 'dugouts', label: 'Dugouts', type: 'checkbox', required: false },
      { key: 'backstop', label: 'Backstop', type: 'checkbox', required: true },
      { key: 'floodlights', label: 'Floodlights', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Handball',
    sportSlug: 'handball',
    category: 'team_sports',
    fields: [
      { key: 'courtSurface', label: 'Court Surface', type: 'select', options: ['Indoor Wood', 'Synthetic', 'Concrete', 'PVC'], required: true },
      { key: 'goalSize', label: 'Goal Size', type: 'select', options: ['Regulation', 'Mini'], required: true },
      { key: 'wallAvailable', label: 'Wall (if indoor)', type: 'checkbox', required: false },
      { key: 'scoreboard', label: 'Scoreboard', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Kabaddi',
    sportSlug: 'kabaddi',
    category: 'team_sports',
    fields: [
      { key: 'courtType', label: 'Court Type', type: 'select', options: ['Indoor Mat', 'Outdoor Clay', 'Synthetic'], required: true },
      { key: 'matType', label: 'Mat Type', type: 'select', options: ['Standard', 'Pro Kabaddi Style'], required: false },
      { key: 'boundaryLines', label: 'Boundary Lines Marked', type: 'checkbox', required: true },
      { key: 'baulkLine', label: 'Baulk Line Marked', type: 'checkbox', required: true },
      { key: 'bonusLine', label: 'Bonus Line Marked', type: 'checkbox', required: false },
      { key: 'scoreboard', label: 'Scoreboard', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Kho Kho',
    sportSlug: 'kho-kho',
    category: 'team_sports',
    fields: [
      { key: 'groundType', label: 'Ground Type', type: 'select', options: ['Clay', 'Grass', 'Synthetic', 'Indoor'], required: true },
      { key: 'polesInstalled', label: 'Poles Installed', type: 'checkbox', required: true },
      { key: 'laneMarked', label: 'Lane Marked', type: 'checkbox', required: true },
      { key: 'crossLanes', label: 'Cross Lanes Marked', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Lacrosse',
    sportSlug: 'lacrosse',
    category: 'team_sports',
    fields: [
      { key: 'fieldType', label: 'Field Type', type: 'select', options: ['Outdoor Field', 'Indoor Box'], required: true },
      { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Natural Grass', 'Artificial Turf'], required: true },
      { key: 'goalCages', label: 'Goal Cages', type: 'checkbox', required: true },
      { key: 'creasesMarked', label: 'Creases Marked', type: 'checkbox', required: false },
      { key: 'equipmentRental', label: 'Equipment Rental', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'American Football',
    sportSlug: 'american-football',
    category: 'team_sports',
    fields: [
      { key: 'fieldType', label: 'Field Type', type: 'select', options: ['Full Size', 'Flag Football'], required: true },
      { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Natural Grass', 'Artificial Turf', 'Hybrid'], required: true },
      { key: 'goalPosts', label: 'Goal Posts', type: 'checkbox', required: true },
      { key: 'yardMarkers', label: 'Yard Markers', type: 'checkbox', required: false },
      { key: 'endZones', label: 'End Zones Marked', type: 'checkbox', required: false },
      { key: 'equipmentProvided', label: 'Equipment Provided', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // RACKET SPORTS
  // ========================================
  {
    sportName: 'Badminton',
    sportSlug: 'badminton',
    category: 'racket_sports',
    fields: [
      { key: 'numberOfCourts', label: 'Number of Courts', type: 'number', required: true, min: 1 },
      { key: 'flooringType', label: 'Flooring Type', type: 'select', options: ['Wooden', 'Synthetic', 'PVC', 'Mat', 'Vinyl'], required: true },
      { key: 'ceilingHeight', label: 'Ceiling Height', type: 'number', unit: 'feet', required: false, placeholder: 'Min 30ft recommended' },
      { key: 'shuttlecockProvided', label: 'Shuttlecock Provided', type: 'checkbox', required: false },
      { key: 'racketRental', label: 'Racket Rental', type: 'checkbox', required: false },
      { key: 'airConditioning', label: 'Air Conditioning', type: 'checkbox', required: false },
      { key: 'spectatorSeating', label: 'Spectator Seating', type: 'checkbox', required: false },
      { key: 'lighting', label: 'Professional Lighting', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Tennis',
    sportSlug: 'tennis',
    category: 'racket_sports',
    fields: [
      { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Hard Court', 'Clay', 'Grass', 'Carpet', 'Artificial Grass'], required: true },
      { key: 'courtType', label: 'Court Type', type: 'select', options: ['Singles', 'Doubles', 'Both'], required: false },
      { key: 'netCondition', label: 'Net Condition', type: 'select', options: ['New', 'Good', 'Average'], required: false },
      { key: 'ballMachine', label: 'Ball Machine Available', type: 'checkbox', required: false },
      { key: 'floodlights', label: 'Floodlights', type: 'checkbox', required: false },
      { key: 'practiceWall', label: 'Practice Wall', type: 'checkbox', required: false },
      { key: 'umpireChair', label: 'Umpire Chair', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false },
      { key: 'racketRental', label: 'Racket Rental', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Squash',
    sportSlug: 'squash',
    category: 'racket_sports',
    fields: [
      { key: 'courtType', label: 'Court Type', type: 'select', options: ['Singles', 'Doubles'], required: true },
      { key: 'wallMaterial', label: 'Wall Material', type: 'select', options: ['Plaster', 'Glass Back', 'Full Glass', 'Hardplaster'], required: true },
      { key: 'floorType', label: 'Floor Type', type: 'select', options: ['Wooden', 'Synthetic'], required: true },
      { key: 'ballProvided', label: 'Ball Provided', type: 'checkbox', required: false },
      { key: 'racketRental', label: 'Racket Rental', type: 'checkbox', required: false },
      { key: 'viewingGallery', label: 'Viewing Gallery', type: 'checkbox', required: false },
      { key: 'airConditioning', label: 'Air Conditioning', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Table Tennis',
    sportSlug: 'table-tennis',
    category: 'racket_sports',
    fields: [
      { key: 'numberOfTables', label: 'Number of Tables', type: 'number', required: true, min: 1 },
      { key: 'tableQuality', label: 'Table Quality', type: 'select', options: ['Competition Grade', 'Recreational', 'Outdoor'], required: true },
      { key: 'robotBallMachine', label: 'Robot/Ball Machine', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false },
      { key: 'paddleRental', label: 'Paddle Rental', type: 'checkbox', required: false },
      { key: 'barrierSurrounds', label: 'Barrier Surrounds', type: 'checkbox', required: false },
      { key: 'airConditioning', label: 'Air Conditioning', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Pickleball',
    sportSlug: 'pickleball',
    category: 'racket_sports',
    fields: [
      { key: 'courtSurface', label: 'Court Surface', type: 'select', options: ['Concrete', 'Asphalt', 'Indoor Wood', 'Synthetic'], required: true },
      { key: 'numberOfCourts', label: 'Number of Courts', type: 'number', required: true, min: 1 },
      { key: 'netType', label: 'Net Type', type: 'select', options: ['Portable', 'Permanent'], required: false },
      { key: 'equipmentRental', label: 'Equipment Rental', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false },
      { key: 'indoorOutdoor', label: 'Indoor/Outdoor', type: 'select', options: ['Indoor', 'Outdoor', 'Both'], required: false }
    ]
  },
  {
    sportName: 'Racquetball',
    sportSlug: 'racquetball',
    category: 'racket_sports',
    fields: [
      { key: 'courtType', label: 'Court Type', type: 'select', options: ['Indoor Standard', 'Outdoor'], required: true },
      { key: 'wallMaterial', label: 'Wall Material', type: 'select', options: ['Concrete', 'Panel', 'Glass Back'], required: true },
      { key: 'eyewearProvided', label: 'Eyewear Provided', type: 'checkbox', required: false },
      { key: 'racketRental', label: 'Racket Rental', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Padel',
    sportSlug: 'padel',
    category: 'racket_sports',
    fields: [
      { key: 'courtType', label: 'Court Type', type: 'select', options: ['Glass Enclosed', 'Mesh Enclosed'], required: true },
      { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Artificial Grass', 'Concrete', 'Synthetic'], required: true },
      { key: 'numberOfCourts', label: 'Number of Courts', type: 'number', required: true, min: 1 },
      { key: 'racketRental', label: 'Racket Rental', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false },
      { key: 'floodlights', label: 'Floodlights', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // WATER SPORTS
  // ========================================
  {
    sportName: 'Swimming',
    sportSlug: 'swimming',
    category: 'water_sports',
    fields: [
      { key: 'poolType', label: 'Pool Type', type: 'select', options: ['Olympic', 'Standard', 'Kids', 'Infinity', 'Lap Pool'], required: true },
      { key: 'laneCount', label: 'Lane Count', type: 'number', required: true, min: 1 },
      { key: 'poolLength', label: 'Pool Length', type: 'select', options: ['25m', '50m', '20m', 'Other'], required: true },
      { key: 'poolDepthMin', label: 'Minimum Depth', type: 'number', unit: 'meters', required: true },
      { key: 'poolDepthMax', label: 'Maximum Depth', type: 'number', unit: 'meters', required: true },
      { key: 'heated', label: 'Heated Pool', type: 'checkbox', required: false },
      { key: 'indoorOutdoor', label: 'Indoor/Outdoor', type: 'select', options: ['Indoor', 'Outdoor', 'Retractable Roof'], required: true },
      { key: 'divingBoard', label: 'Diving Board', type: 'checkbox', required: false },
      { key: 'startingBlocks', label: 'Starting Blocks', type: 'checkbox', required: false },
      { key: 'lifeguardOnDuty', label: 'Lifeguard On Duty', type: 'checkbox', required: false },
      { key: 'lockerRooms', label: 'Locker Rooms', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Water Polo',
    sportSlug: 'water-polo',
    category: 'water_sports',
    fields: [
      { key: 'poolDepth', label: 'Pool Depth (min 1.8m)', type: 'number', unit: 'meters', required: true, min: 1.8 },
      { key: 'poolLength', label: 'Pool Length', type: 'select', options: ['25m', '30m', '33m'], required: true },
      { key: 'goalPosts', label: 'Goal Posts Available', type: 'checkbox', required: true },
      { key: 'laneRopesRemovable', label: 'Lane Ropes Removable', type: 'checkbox', required: false },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false },
      { key: 'capsProvided', label: 'Caps Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Diving',
    sportSlug: 'diving',
    category: 'water_sports',
    fields: [
      { key: 'platformHeights', label: 'Platform Heights', type: 'multiselect', options: ['1m', '3m', '5m', '7.5m', '10m'], required: true },
      { key: 'springboard', label: 'Springboard Available', type: 'checkbox', required: false },
      { key: 'bubbleSystem', label: 'Bubble System', type: 'checkbox', required: false },
      { key: 'minimumDepth', label: 'Minimum Depth', type: 'number', unit: 'meters', required: true },
      { key: 'dryLandTraining', label: 'Dry Land Training Area', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Kayaking',
    sportSlug: 'kayaking',
    category: 'water_sports',
    fields: [
      { key: 'waterType', label: 'Water Type', type: 'select', options: ['Lake', 'River', 'Sea', 'Pool'], required: true },
      { key: 'kayaksAvailable', label: 'Kayaks Available', type: 'number', required: true },
      { key: 'kayakType', label: 'Kayak Type', type: 'multiselect', options: ['Single', 'Double', 'Racing', 'Recreational'], required: false },
      { key: 'paddlesProvided', label: 'Paddles Provided', type: 'checkbox', required: false },
      { key: 'lifeJacketsProvided', label: 'Life Jackets Provided', type: 'checkbox', required: true },
      { key: 'instructorAvailable', label: 'Instructor Available', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Rowing',
    sportSlug: 'rowing',
    category: 'water_sports',
    fields: [
      { key: 'waterBody', label: 'Water Body', type: 'select', options: ['Lake', 'River', 'Reservoir', 'Canal'], required: true },
      { key: 'courseLength', label: 'Course Length', type: 'number', unit: 'meters', required: false },
      { key: 'boatTypes', label: 'Boat Types', type: 'multiselect', options: ['Single Scull', 'Double Scull', 'Coxless Pair', 'Four', 'Eight'], required: true },
      { key: 'ergometers', label: 'Ergometers Available', type: 'checkbox', required: false },
      { key: 'boathouse', label: 'Boathouse', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Surfing',
    sportSlug: 'surfing',
    category: 'water_sports',
    fields: [
      { key: 'waveType', label: 'Wave Type', type: 'select', options: ['Beach Break', 'Point Break', 'Reef Break', 'Wave Pool'], required: true },
      { key: 'difficultyLevel', label: 'Difficulty Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'], required: true },
      { key: 'boardRental', label: 'Board Rental', type: 'checkbox', required: false },
      { key: 'wetsuitRental', label: 'Wetsuit Rental', type: 'checkbox', required: false },
      { key: 'instructorAvailable', label: 'Instructor Available', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // COMBAT/MARTIAL ARTS
  // ========================================
  {
    sportName: 'Boxing',
    sportSlug: 'boxing',
    category: 'combat_sports',
    fields: [
      { key: 'ringSize', label: 'Ring Size', type: 'select', options: ['16ft', '18ft', '20ft', 'Training Area'], required: true },
      { key: 'ringType', label: 'Ring Type', type: 'select', options: ['Elevated', 'Floor Level', 'No Ring'], required: false },
      { key: 'heavyBags', label: 'Heavy Bags', type: 'number', required: false },
      { key: 'speedBags', label: 'Speed Bags', type: 'number', required: false },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false },
      { key: 'glovesProvided', label: 'Gloves Provided', type: 'checkbox', required: false },
      { key: 'wrapsProvided', label: 'Hand Wraps Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'MMA',
    sportSlug: 'mma',
    category: 'combat_sports',
    fields: [
      { key: 'matType', label: 'Mat Type', type: 'select', options: ['MMA Cage', 'Wrestling Mat', 'Open Mat', 'Tatami'], required: true },
      { key: 'matSize', label: 'Mat Size', type: 'select', options: ['Competition', 'Training', 'Small'], required: true },
      { key: 'cageAvailable', label: 'Cage Available', type: 'checkbox', required: false },
      { key: 'grapplingDummies', label: 'Grappling Dummies', type: 'checkbox', required: false },
      { key: 'heavyBags', label: 'Heavy Bags', type: 'checkbox', required: false },
      { key: 'glovesProvided', label: 'Gloves Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Wrestling',
    sportSlug: 'wrestling',
    category: 'combat_sports',
    fields: [
      { key: 'matType', label: 'Mat Type', type: 'select', options: ['Competition Mat', 'Practice Mat', 'Foam Mat'], required: true },
      { key: 'matSize', label: 'Mat Size', type: 'select', options: ['12m Circle', '10m Circle', 'Training Size'], required: true },
      { key: 'protectionCircle', label: 'Protection Circle', type: 'checkbox', required: false },
      { key: 'wallPadding', label: 'Wall Padding', type: 'checkbox', required: false },
      { key: 'dummies', label: 'Training Dummies', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Judo',
    sportSlug: 'judo',
    category: 'combat_sports',
    fields: [
      { key: 'matType', label: 'Mat Type', type: 'select', options: ['Tatami', 'EVA Foam', 'Jigsaw Mat'], required: true },
      { key: 'matArea', label: 'Mat Area', type: 'number', unit: 'sqm', required: true },
      { key: 'competitionArea', label: 'Competition Area Marked', type: 'checkbox', required: false },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false },
      { key: 'throwingDummy', label: 'Throwing Dummy', type: 'checkbox', required: false },
      { key: 'giProvided', label: 'Gi (Uniform) Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Karate',
    sportSlug: 'karate',
    category: 'combat_sports',
    fields: [
      { key: 'matType', label: 'Mat Type', type: 'select', options: ['Tatami', 'EVA Foam', 'Wood Floor', 'Puzzle Mat'], required: true },
      { key: 'matArea', label: 'Mat Area', type: 'number', unit: 'sqm', required: true },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false },
      { key: 'punchingBags', label: 'Punching Bags', type: 'checkbox', required: false },
      { key: 'trainingPads', label: 'Training Pads/Shields', type: 'checkbox', required: false },
      { key: 'giProvided', label: 'Gi (Uniform) Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Taekwondo',
    sportSlug: 'taekwondo',
    category: 'combat_sports',
    fields: [
      { key: 'matType', label: 'Mat Type', type: 'select', options: ['Octagonal Mat', 'EVA Foam', 'Tatami', 'Puzzle Mat'], required: true },
      { key: 'matArea', label: 'Mat Area', type: 'number', unit: 'sqm', required: true },
      { key: 'electronicScoringSystem', label: 'Electronic Scoring System', type: 'checkbox', required: false },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false },
      { key: 'kickingPads', label: 'Kicking Pads', type: 'checkbox', required: false },
      { key: 'protectiveGear', label: 'Protective Gear Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Brazilian Jiu-Jitsu',
    sportSlug: 'brazilian-jiu-jitsu',
    category: 'combat_sports',
    fields: [
      { key: 'matType', label: 'Mat Type', type: 'select', options: ['Tatami', 'MMA Mat', 'Wrestling Mat', 'Puzzle Mat'], required: true },
      { key: 'matArea', label: 'Mat Area', type: 'number', unit: 'sqm', required: true },
      { key: 'wallPadding', label: 'Wall Padding', type: 'checkbox', required: false },
      { key: 'grapplingDummies', label: 'Grappling Dummies', type: 'checkbox', required: false },
      { key: 'giProvided', label: 'Gi Provided', type: 'checkbox', required: false },
      { key: 'noGiEquipment', label: 'No-Gi Equipment', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Muay Thai',
    sportSlug: 'muay-thai',
    category: 'combat_sports',
    fields: [
      { key: 'ringAvailable', label: 'Ring Available', type: 'checkbox', required: false },
      { key: 'ringSize', label: 'Ring Size', type: 'select', options: ['16ft', '18ft', '20ft', 'No Ring'], required: false },
      { key: 'heavyBags', label: 'Heavy Bags', type: 'number', required: false },
      { key: 'thaiPads', label: 'Thai Pads', type: 'checkbox', required: false },
      { key: 'kickShields', label: 'Kick Shields', type: 'checkbox', required: false },
      { key: 'glovesProvided', label: 'Gloves Provided', type: 'checkbox', required: false },
      { key: 'shinGuards', label: 'Shin Guards Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Fencing',
    sportSlug: 'fencing',
    category: 'combat_sports',
    fields: [
      { key: 'numberOfPistes', label: 'Number of Pistes', type: 'number', required: true, min: 1 },
      { key: 'pisteType', label: 'Piste Type', type: 'select', options: ['Metallic', 'Non-metallic', 'Rubber'], required: true },
      { key: 'scoringEquipment', label: 'Electronic Scoring Equipment', type: 'checkbox', required: false },
      { key: 'weaponRental', label: 'Weapon Rental', type: 'multiselect', options: ['Foil', 'Epee', 'Sabre'], required: false },
      { key: 'protectiveGear', label: 'Protective Gear Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Kickboxing',
    sportSlug: 'kickboxing',
    category: 'combat_sports',
    fields: [
      { key: 'ringAvailable', label: 'Ring Available', type: 'checkbox', required: false },
      { key: 'matArea', label: 'Mat/Training Area', type: 'number', unit: 'sqm', required: true },
      { key: 'heavyBags', label: 'Heavy Bags', type: 'number', required: false },
      { key: 'speedBags', label: 'Speed Bags', type: 'number', required: false },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false },
      { key: 'glovesProvided', label: 'Gloves Provided', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // TARGET SPORTS
  // ========================================
  {
    sportName: 'Archery',
    sportSlug: 'archery',
    category: 'target_sports',
    fields: [
      { key: 'rangeType', label: 'Range Type', type: 'select', options: ['Indoor', 'Outdoor', 'Both'], required: true },
      { key: 'rangeDistances', label: 'Range Distances Available', type: 'multiselect', options: ['10m', '18m', '30m', '50m', '70m', '90m'], required: true },
      { key: 'numberOfLanes', label: 'Number of Lanes', type: 'number', required: true, min: 1 },
      { key: 'targetType', label: 'Target Type', type: 'select', options: ['Paper', '3D', 'Field', 'Multiple'], required: true },
      { key: 'equipmentRental', label: 'Equipment Rental (Bows, Arrows)', type: 'checkbox', required: false },
      { key: 'safetyNetting', label: 'Safety Netting', type: 'checkbox', required: true },
      { key: 'instructorAvailable', label: 'Instructor Available', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Shooting',
    sportSlug: 'shooting',
    category: 'target_sports',
    fields: [
      { key: 'rangeType', label: 'Range Type', type: 'select', options: ['Indoor', 'Outdoor'], required: true },
      { key: 'shootingType', label: 'Shooting Type', type: 'multiselect', options: ['Rifle', 'Pistol', 'Shotgun', 'Air Gun', 'Air Pistol'], required: true },
      { key: 'numberOfLanes', label: 'Number of Lanes', type: 'number', required: true, min: 1 },
      { key: 'distanceOptions', label: 'Distance Options', type: 'multiselect', options: ['10m', '25m', '50m', '100m'], required: true },
      { key: 'equipmentRental', label: 'Equipment Rental', type: 'checkbox', required: false },
      { key: 'ammunitionSold', label: 'Ammunition Sold', type: 'checkbox', required: false },
      { key: 'instructorAvailable', label: 'Instructor Available', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Golf',
    sportSlug: 'golf',
    category: 'target_sports',
    fields: [
      { key: 'facilityType', label: 'Facility Type', type: 'select', options: ['Full Course', 'Driving Range', 'Mini Golf', 'Simulator', 'Putting Green'], required: true },
      { key: 'numberOfHoles', label: 'Number of Holes', type: 'select', options: ['9', '18', 'Practice Green Only'], required: false },
      { key: 'drivingRangeBays', label: 'Driving Range Bays', type: 'number', required: false },
      { key: 'clubRental', label: 'Club Rental', type: 'checkbox', required: false },
      { key: 'golfCartAvailable', label: 'Golf Cart Available', type: 'checkbox', required: false },
      { key: 'proShop', label: 'Pro Shop', type: 'checkbox', required: false },
      { key: 'caddy', label: 'Caddy Service', type: 'checkbox', required: false },
      { key: 'courseRating', label: 'Course Rating', type: 'text', required: false }
    ]
  },
  {
    sportName: 'Darts',
    sportSlug: 'darts',
    category: 'target_sports',
    fields: [
      { key: 'numberOfBoards', label: 'Number of Boards', type: 'number', required: true, min: 1 },
      { key: 'boardType', label: 'Board Type', type: 'select', options: ['Bristle (Steel Tip)', 'Electronic (Soft Tip)', 'Both'], required: true },
      { key: 'dartsProvided', label: 'Darts Provided', type: 'checkbox', required: false },
      { key: 'oches', label: 'Proper Oches (Throw Lines)', type: 'checkbox', required: false },
      { key: 'lighting', label: 'Professional Lighting', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // FITNESS/GYM
  // ========================================
  {
    sportName: 'Gym',
    sportSlug: 'gym',
    category: 'fitness',
    fields: [
      { key: 'areaTypes', label: 'Area Types', type: 'multiselect', options: ['Cardio', 'Free Weights', 'Weight Machines', 'Functional', 'CrossFit', 'Stretching'], required: true },
      { key: 'cardioMachines', label: 'Cardio Machines', type: 'number', required: false },
      { key: 'freeWeights', label: 'Free Weights Section', type: 'checkbox', required: false },
      { key: 'weightMachines', label: 'Weight Machines', type: 'checkbox', required: false },
      { key: 'personalTrainer', label: 'Personal Trainer Available', type: 'checkbox', required: false },
      { key: 'lockerRooms', label: 'Locker Rooms', type: 'checkbox', required: false },
      { key: 'towelService', label: 'Towel Service', type: 'checkbox', required: false },
      { key: 'airConditioning', label: 'Air Conditioning', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'CrossFit',
    sportSlug: 'crossfit',
    category: 'fitness',
    fields: [
      { key: 'boxSize', label: 'Box Size', type: 'number', unit: 'sqft', required: true },
      { key: 'pullUpRigs', label: 'Pull-Up Rigs', type: 'number', required: false },
      { key: 'olympicPlatforms', label: 'Olympic Lifting Platforms', type: 'number', required: false },
      { key: 'rowingMachines', label: 'Rowing Machines', type: 'number', required: false },
      { key: 'assaultBikes', label: 'Assault/Air Bikes', type: 'number', required: false },
      { key: 'kettlebells', label: 'Kettlebells Available', type: 'checkbox', required: false },
      { key: 'wallBalls', label: 'Wall Balls', type: 'checkbox', required: false },
      { key: 'coachAvailable', label: 'Coach Available', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Yoga',
    sportSlug: 'yoga',
    category: 'fitness',
    fields: [
      { key: 'studioSize', label: 'Studio Size', type: 'number', unit: 'sqft', required: true },
      { key: 'maxCapacity', label: 'Max Capacity', type: 'number', required: true },
      { key: 'matsProvided', label: 'Mats Provided', type: 'checkbox', required: false },
      { key: 'propsAvailable', label: 'Props Available (Blocks, Straps, Bolsters)', type: 'checkbox', required: false },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false },
      { key: 'soundSystem', label: 'Sound System', type: 'checkbox', required: false },
      { key: 'airConditioning', label: 'Air Conditioning', type: 'checkbox', required: false },
      { key: 'hotYoga', label: 'Hot Yoga Capable (Heated Room)', type: 'checkbox', required: false },
      { key: 'naturalLighting', label: 'Natural Lighting', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Pilates',
    sportSlug: 'pilates',
    category: 'fitness',
    fields: [
      { key: 'studioSize', label: 'Studio Size', type: 'number', unit: 'sqft', required: true },
      { key: 'maxCapacity', label: 'Max Capacity', type: 'number', required: true },
      { key: 'reformers', label: 'Reformers Available', type: 'number', required: false },
      { key: 'cadillac', label: 'Cadillac/Trapeze Table', type: 'checkbox', required: false },
      { key: 'chairs', label: 'Pilates Chairs', type: 'checkbox', required: false },
      { key: 'barrels', label: 'Barrels', type: 'checkbox', required: false },
      { key: 'matsProvided', label: 'Mats Provided', type: 'checkbox', required: false },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Dance',
    sportSlug: 'dance',
    category: 'fitness',
    fields: [
      { key: 'floorType', label: 'Floor Type', type: 'select', options: ['Sprung Wood', 'Marley', 'Vinyl', 'Concrete', 'Laminate'], required: true },
      { key: 'studioSize', label: 'Studio Size', type: 'number', unit: 'sqft', required: true },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: true },
      { key: 'balletBarre', label: 'Ballet Barre', type: 'checkbox', required: false },
      { key: 'soundSystem', label: 'Sound System', type: 'checkbox', required: true },
      { key: 'maxCapacity', label: 'Max Capacity', type: 'number', required: true },
      { key: 'changingRooms', label: 'Changing Rooms', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Aerobics',
    sportSlug: 'aerobics',
    category: 'fitness',
    fields: [
      { key: 'studioSize', label: 'Studio Size', type: 'number', unit: 'sqft', required: true },
      { key: 'maxCapacity', label: 'Max Capacity', type: 'number', required: true },
      { key: 'floorType', label: 'Floor Type', type: 'select', options: ['Sprung Wood', 'Rubber', 'Foam', 'Carpet'], required: true },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false },
      { key: 'soundSystem', label: 'Sound System', type: 'checkbox', required: true },
      { key: 'stepsProvided', label: 'Aerobic Steps Provided', type: 'checkbox', required: false },
      { key: 'weightsProvided', label: 'Weights Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Zumba',
    sportSlug: 'zumba',
    category: 'fitness',
    fields: [
      { key: 'studioSize', label: 'Studio Size', type: 'number', unit: 'sqft', required: true },
      { key: 'maxCapacity', label: 'Max Capacity', type: 'number', required: true },
      { key: 'floorType', label: 'Floor Type', type: 'select', options: ['Wood', 'Rubber', 'Vinyl'], required: true },
      { key: 'mirrorWall', label: 'Mirror Wall', type: 'checkbox', required: false },
      { key: 'soundSystem', label: 'Sound System (Quality)', type: 'select', options: ['Basic', 'Professional', 'Premium'], required: true },
      { key: 'airConditioning', label: 'Air Conditioning', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // INDOOR GAMES
  // ========================================
  {
    sportName: 'Bowling',
    sportSlug: 'bowling',
    category: 'indoor_games',
    fields: [
      { key: 'numberOfLanes', label: 'Number of Lanes', type: 'number', required: true, min: 1 },
      { key: 'laneType', label: 'Lane Type', type: 'select', options: ['Synthetic', 'Wood'], required: false },
      { key: 'bumperRails', label: 'Bumper Rails Available', type: 'checkbox', required: false },
      { key: 'shoeRental', label: 'Shoe Rental', type: 'checkbox', required: true },
      { key: 'automaticScoring', label: 'Automatic Scoring', type: 'checkbox', required: false },
      { key: 'ballWeights', label: 'Ball Weights Available', type: 'text', placeholder: 'e.g., 6-16 lbs', required: false }
    ]
  },
  {
    sportName: 'Snooker',
    sportSlug: 'snooker',
    category: 'indoor_games',
    fields: [
      { key: 'numberOfTables', label: 'Number of Tables', type: 'number', required: true, min: 1 },
      { key: 'tableSize', label: 'Table Size', type: 'select', options: ['Full Size (12ft)', '10ft', '9ft'], required: true },
      { key: 'tableCondition', label: 'Table Condition', type: 'select', options: ['Tournament Grade', 'Professional', 'Standard', 'Practice'], required: false },
      { key: 'cueRental', label: 'Cue Rental', type: 'checkbox', required: false },
      { key: 'lighting', label: 'Professional Lighting', type: 'checkbox', required: false },
      { key: 'airConditioning', label: 'Air Conditioning', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Pool',
    sportSlug: 'pool',
    category: 'indoor_games',
    fields: [
      { key: 'numberOfTables', label: 'Number of Tables', type: 'number', required: true, min: 1 },
      { key: 'tableSize', label: 'Table Size', type: 'select', options: ['9ft', '8ft', '7ft (Bar Size)'], required: true },
      { key: 'gameType', label: 'Game Type', type: 'select', options: ['8-Ball', '9-Ball', 'Both', 'Multiple'], required: false },
      { key: 'cueRental', label: 'Cue Rental', type: 'checkbox', required: false },
      { key: 'tournamentGrade', label: 'Tournament Grade Tables', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Carrom',
    sportSlug: 'carrom',
    category: 'indoor_games',
    fields: [
      { key: 'numberOfBoards', label: 'Number of Boards', type: 'number', required: true, min: 1 },
      { key: 'boardQuality', label: 'Board Quality', type: 'select', options: ['Tournament', 'Professional', 'Standard'], required: true },
      { key: 'strikersProvided', label: 'Strikers Provided', type: 'checkbox', required: false },
      { key: 'powderProvided', label: 'Powder Provided', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Chess',
    sportSlug: 'chess',
    category: 'indoor_games',
    fields: [
      { key: 'numberOfSets', label: 'Number of Sets/Tables', type: 'number', required: true, min: 1 },
      { key: 'boardType', label: 'Board Type', type: 'select', options: ['Tournament', 'Standard', 'Digital'], required: false },
      { key: 'clocksAvailable', label: 'Tournament Clocks Available', type: 'checkbox', required: false },
      { key: 'quietEnvironment', label: 'Quiet Environment', type: 'checkbox', required: false },
      { key: 'computerAnalysis', label: 'Computer Analysis Available', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // SKATING/CYCLING
  // ========================================
  {
    sportName: 'Ice Skating',
    sportSlug: 'ice-skating',
    category: 'skating_cycling',
    fields: [
      { key: 'rinkSize', label: 'Rink Size', type: 'select', options: ['Olympic', 'NHL', 'Recreational', 'Small'], required: true },
      { key: 'sessionType', label: 'Session Type', type: 'multiselect', options: ['Public Skate', 'Hockey', 'Figure Skating', 'Speed Skating'], required: true },
      { key: 'skateRental', label: 'Skate Rental', type: 'checkbox', required: false },
      { key: 'helmetRental', label: 'Helmet Rental', type: 'checkbox', required: false },
      { key: 'lockerAvailable', label: 'Locker Available', type: 'checkbox', required: false },
      { key: 'skateSharpening', label: 'Skate Sharpening Service', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Roller Skating',
    sportSlug: 'roller-skating',
    category: 'skating_cycling',
    fields: [
      { key: 'rinkType', label: 'Rink Type', type: 'select', options: ['Indoor Rink', 'Outdoor Rink', 'Street Course'], required: true },
      { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Wood', 'Concrete', 'Sport Court'], required: true },
      { key: 'skateRental', label: 'Skate Rental', type: 'checkbox', required: false },
      { key: 'protectiveGear', label: 'Protective Gear Rental', type: 'checkbox', required: false },
      { key: 'musicDJ', label: 'Music/DJ', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Skateboarding',
    sportSlug: 'skateboarding',
    category: 'skating_cycling',
    fields: [
      { key: 'parkType', label: 'Park Type', type: 'select', options: ['Indoor Park', 'Outdoor Park', 'Street Course', 'Bowl', 'Vert Ramp'], required: true },
      { key: 'features', label: 'Features', type: 'multiselect', options: ['Half Pipe', 'Quarter Pipe', 'Rails', 'Stairs', 'Ledges', 'Bowls', 'Ramps'], required: false },
      { key: 'boardRental', label: 'Board Rental', type: 'checkbox', required: false },
      { key: 'protectiveGear', label: 'Protective Gear Rental', type: 'checkbox', required: false },
      { key: 'difficultyLevel', label: 'Difficulty Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'], required: false }
    ]
  },
  {
    sportName: 'Cycling',
    sportSlug: 'cycling',
    category: 'skating_cycling',
    fields: [
      { key: 'trackType', label: 'Track Type', type: 'select', options: ['Velodrome', 'BMX Track', 'Mountain Trail', 'Road Circuit', 'Indoor Cycling'], required: true },
      { key: 'trackLength', label: 'Track Length', type: 'number', unit: 'meters', required: false },
      { key: 'bikeRental', label: 'Bike Rental', type: 'checkbox', required: false },
      { key: 'helmetProvided', label: 'Helmet Provided', type: 'checkbox', required: false },
      { key: 'difficultyLevel', label: 'Difficulty Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'], required: false },
      { key: 'lightingForNight', label: 'Lighting for Night Riding', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'BMX',
    sportSlug: 'bmx',
    category: 'skating_cycling',
    fields: [
      { key: 'trackType', label: 'Track Type', type: 'select', options: ['Racing Track', 'Freestyle Park', 'Dirt Jumps'], required: true },
      { key: 'features', label: 'Features', type: 'multiselect', options: ['Jumps', 'Berms', 'Rhythm Section', 'Start Gate', 'Ramps', 'Rails'], required: false },
      { key: 'bikeRental', label: 'Bike Rental', type: 'checkbox', required: false },
      { key: 'protectiveGear', label: 'Protective Gear', type: 'checkbox', required: false },
      { key: 'startGate', label: 'Electronic Start Gate', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // OUTDOOR/ADVENTURE
  // ========================================
  {
    sportName: 'Rock Climbing',
    sportSlug: 'rock-climbing',
    category: 'outdoor_adventure',
    fields: [
      { key: 'wallType', label: 'Wall Type', type: 'select', options: ['Indoor', 'Outdoor', 'Bouldering Only'], required: true },
      { key: 'wallHeight', label: 'Wall Height', type: 'number', unit: 'feet', required: true },
      { key: 'difficultyRange', label: 'Difficulty Range', type: 'text', placeholder: 'e.g., V0-V8 or 5.6-5.12', required: true },
      { key: 'autoBelay', label: 'Auto Belay Systems', type: 'checkbox', required: false },
      { key: 'equipmentRental', label: 'Equipment Rental (Harness, Shoes, Chalk)', type: 'checkbox', required: false },
      { key: 'leadClimbing', label: 'Lead Climbing Available', type: 'checkbox', required: false },
      { key: 'boulderingArea', label: 'Bouldering Area', type: 'checkbox', required: false },
      { key: 'instructorAvailable', label: 'Instructor Available', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Horse Riding',
    sportSlug: 'horse-riding',
    category: 'outdoor_adventure',
    fields: [
      { key: 'arenaType', label: 'Arena Type', type: 'select', options: ['Indoor', 'Outdoor', 'Both'], required: true },
      { key: 'arenaSize', label: 'Arena Size', type: 'number', unit: 'meters', required: true },
      { key: 'horsesAvailable', label: 'Horses Available', type: 'number', required: true },
      { key: 'skillLevels', label: 'Skill Levels', type: 'multiselect', options: ['Beginner', 'Intermediate', 'Advanced', 'Competition'], required: true },
      { key: 'equipmentProvided', label: 'Equipment Provided (Helmet, Boots)', type: 'checkbox', required: false },
      { key: 'trailRiding', label: 'Trail Riding Available', type: 'checkbox', required: false },
      { key: 'jumpingCourse', label: 'Jumping Course', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Paintball',
    sportSlug: 'paintball',
    category: 'outdoor_adventure',
    fields: [
      { key: 'fieldType', label: 'Field Type', type: 'select', options: ['Outdoor Woodland', 'Indoor Arena', 'Speedball', 'Scenario'], required: true },
      { key: 'fieldSize', label: 'Field Size', type: 'number', unit: 'acres', required: false },
      { key: 'equipmentRental', label: 'Equipment Rental (Marker, Mask, Hopper)', type: 'checkbox', required: true },
      { key: 'paintballsIncluded', label: 'Paintballs Included', type: 'checkbox', required: false },
      { key: 'referees', label: 'Referees Provided', type: 'checkbox', required: false },
      { key: 'numberOfFields', label: 'Number of Fields', type: 'number', required: false }
    ]
  },
  {
    sportName: 'Laser Tag',
    sportSlug: 'laser-tag',
    category: 'outdoor_adventure',
    fields: [
      { key: 'arenaType', label: 'Arena Type', type: 'select', options: ['Indoor', 'Outdoor', 'Both'], required: true },
      { key: 'arenaSize', label: 'Arena Size', type: 'number', unit: 'sqft', required: true },
      { key: 'maxPlayers', label: 'Max Players per Game', type: 'number', required: true },
      { key: 'equipmentIncluded', label: 'Equipment Included', type: 'checkbox', required: true },
      { key: 'multiLevelArena', label: 'Multi-Level Arena', type: 'checkbox', required: false },
      { key: 'scoringSystem', label: 'Scoring System', type: 'select', options: ['Basic', 'Advanced with Stats'], required: false }
    ]
  },
  {
    sportName: 'Go-Karting',
    sportSlug: 'go-karting',
    category: 'outdoor_adventure',
    fields: [
      { key: 'trackType', label: 'Track Type', type: 'select', options: ['Indoor', 'Outdoor', 'Both'], required: true },
      { key: 'trackLength', label: 'Track Length', type: 'number', unit: 'meters', required: true },
      { key: 'kartType', label: 'Kart Type', type: 'multiselect', options: ['Adult', 'Junior', 'Double Seater', 'Racing'], required: true },
      { key: 'maxSpeed', label: 'Max Speed', type: 'number', unit: 'km/h', required: false },
      { key: 'safetyGear', label: 'Safety Gear Provided', type: 'checkbox', required: true },
      { key: 'lapTiming', label: 'Lap Timing System', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Trampoline',
    sportSlug: 'trampoline',
    category: 'outdoor_adventure',
    fields: [
      { key: 'parkType', label: 'Park Type', type: 'select', options: ['Indoor Park', 'Outdoor', 'Single Trampoline'], required: true },
      { key: 'numberOfTrampolines', label: 'Number of Trampolines', type: 'number', required: true },
      { key: 'foamPit', label: 'Foam Pit', type: 'checkbox', required: false },
      { key: 'dodgeball', label: 'Dodgeball Area', type: 'checkbox', required: false },
      { key: 'basketballHoops', label: 'Basketball Hoops', type: 'checkbox', required: false },
      { key: 'ninjaWarrior', label: 'Ninja Warrior Course', type: 'checkbox', required: false },
      { key: 'gripSocks', label: 'Grip Socks Required/Provided', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // ESPORTS
  // ========================================
  {
    sportName: 'Gaming Arena',
    sportSlug: 'gaming-arena',
    category: 'esports',
    fields: [
      { key: 'numberOfStations', label: 'Number of Stations', type: 'number', required: true, min: 1 },
      { key: 'platform', label: 'Platform', type: 'multiselect', options: ['Gaming PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'VR'], required: true },
      { key: 'gamesAvailable', label: 'Games Available', type: 'textarea', placeholder: 'List popular games available', required: false },
      { key: 'vrSetup', label: 'VR Setup', type: 'checkbox', required: false },
      { key: 'streamingSetup', label: 'Streaming Setup', type: 'checkbox', required: false },
      { key: 'tournamentReady', label: 'Tournament Ready', type: 'checkbox', required: false },
      { key: 'headsetProvided', label: 'Headset Provided', type: 'checkbox', required: false },
      { key: 'highSpeedInternet', label: 'High Speed Internet', type: 'checkbox', required: false },
      { key: 'pcSpecs', label: 'PC Specifications', type: 'textarea', placeholder: 'e.g., RTX 3080, i9, 32GB RAM', required: false }
    ]
  },
  {
    sportName: 'Esports',
    sportSlug: 'esports',
    category: 'esports',
    fields: [
      { key: 'numberOfStations', label: 'Number of Stations', type: 'number', required: true, min: 1 },
      { key: 'gameTitles', label: 'Game Titles', type: 'multiselect', options: ['League of Legends', 'Dota 2', 'CS:GO', 'Valorant', 'Fortnite', 'Call of Duty', 'FIFA', 'Rocket League', 'PUBG', 'Overwatch'], required: false },
      { key: 'monitorRefreshRate', label: 'Monitor Refresh Rate', type: 'select', options: ['60Hz', '144Hz', '240Hz', '360Hz'], required: false },
      { key: 'peripheralsProvided', label: 'Peripherals Provided', type: 'checkbox', required: false },
      { key: 'coachingAvailable', label: 'Coaching Available', type: 'checkbox', required: false },
      { key: 'tournamentCapable', label: 'Tournament Capable', type: 'checkbox', required: false },
      { key: 'broadcastSetup', label: 'Broadcast Setup', type: 'checkbox', required: false }
    ]
  },

  // ========================================
  // OTHER SPORTS
  // ========================================
  {
    sportName: 'Athletics',
    sportSlug: 'athletics',
    category: 'other',
    fields: [
      { key: 'trackType', label: 'Track Type', type: 'select', options: ['Synthetic', 'Cinder', 'Grass', 'Indoor'], required: true },
      { key: 'trackLength', label: 'Track Length', type: 'select', options: ['200m', '400m', 'Other'], required: true },
      { key: 'lanes', label: 'Number of Lanes', type: 'number', required: true },
      { key: 'fieldEvents', label: 'Field Events Available', type: 'multiselect', options: ['Long Jump', 'High Jump', 'Shot Put', 'Discus', 'Javelin', 'Pole Vault'], required: false },
      { key: 'floodlights', label: 'Floodlights', type: 'checkbox', required: false },
      { key: 'timingSystem', label: 'Electronic Timing System', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Gymnastics',
    sportSlug: 'gymnastics',
    category: 'other',
    fields: [
      { key: 'apparatus', label: 'Apparatus Available', type: 'multiselect', options: ['Vault', 'Uneven Bars', 'Balance Beam', 'Floor', 'Pommel Horse', 'Rings', 'Parallel Bars', 'High Bar', 'Trampoline'], required: true },
      { key: 'sprungFloor', label: 'Sprung Floor', type: 'checkbox', required: false },
      { key: 'pitFoam', label: 'Foam Pit', type: 'checkbox', required: false },
      { key: 'matting', label: 'Safety Matting', type: 'checkbox', required: true },
      { key: 'coachAvailable', label: 'Coach Available', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Weightlifting',
    sportSlug: 'weightlifting',
    category: 'other',
    fields: [
      { key: 'platforms', label: 'Number of Platforms', type: 'number', required: true },
      { key: 'barbellType', label: 'Barbell Type', type: 'multiselect', options: ['Olympic', 'Powerlifting', 'Training'], required: true },
      { key: 'maxWeight', label: 'Max Weight Available', type: 'number', unit: 'kg', required: false },
      { key: 'bumperPlates', label: 'Bumper Plates', type: 'checkbox', required: false },
      { key: 'chalk', label: 'Chalk Allowed', type: 'checkbox', required: false },
      { key: 'coachAvailable', label: 'Coach Available', type: 'checkbox', required: false }
    ]
  },
  {
    sportName: 'Netball',
    sportSlug: 'netball',
    category: 'team_sports',
    fields: [
      { key: 'courtType', label: 'Court Type', type: 'select', options: ['Indoor', 'Outdoor', 'Multi-purpose'], required: true },
      { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Hard Court', 'Synthetic', 'Grass'], required: true },
      { key: 'goalPosts', label: 'Goal Posts', type: 'select', options: ['Fixed', 'Adjustable Height'], required: true },
      { key: 'ballsProvided', label: 'Balls Provided', type: 'checkbox', required: false },
      { key: 'bibs', label: 'Bibs/Pinnies Provided', type: 'checkbox', required: false }
    ]
  }
];

export default sportTemplatesData;
