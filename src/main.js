
let brushedMultiple;

function brush(multiple, {dots, scales, width, height}) {
  const brushed = ([prop1, prop2]) => {
    const selection = d3.event.selection;

    if (selection === null) {
      return;
    } else {
      const [[x0, y0], [x1, y1]] = selection;

      dots
        .classed('highlighted',  d => {
          const x = scales[prop1].x(d[prop1]);
          const y = scales[prop2].y(d[prop2]);

          return x0 <= x && x <= x1 && y0 <= y && y <= y1;
        });
    }
  };

  const brush = d3.brush()
    .on('start.color brush.color end.color', brushed)
    .on('start', function (d) {
      if (brushedMultiple !== this) {
        d3.select(brushedMultiple).call(brush.move, null);
        brushedMultiple = this;
      }
    })
    .extent([[0, 0], [width, height]]);

  multiple.append("g")
    .attr("class", "brush")
    .call(brush);
}

function createVisualization({w, h, margin}, dataset) {
  // use scaleband to divide w into x and y segments
  // feed data to selectAll('svg')
  const properties = [
    'danceability',
    'energy',
    'valence',
    'loudness',
    'tempo',
    'duration_ms',
    'liveness'
  ];

  const xScaleMultiple = d3.scaleBand()
    .domain(properties)
    .range([0, w])
    .paddingOuter(.15)
    .paddingInner(.10);

  const yScaleMultiple = d3.scaleBand()
    .domain(properties)
    .range([h, 0])
    .paddingOuter(.15)
    .paddingInner(.10);

  const multiples = d3.select('#multiples')
    .attr('width', w)
    .attr('height', h)
    .selectAll('g')
    .data(d3.cross(properties, properties))
    .join('g')
    .attr('transform', d => `translate(${xScaleMultiple(d[0])}, ${yScaleMultiple(d[1])})`);
    
  const scales = properties.reduce((scaleObj, prop) => {
    const x = ['danceability', 'energy', 'valence', 'liveness'].indexOf(prop) === -1
      ? d3.scaleLinear()
          .domain(d3.extent(dataset, d => d[prop]))
          .range([5, xScaleMultiple.bandwidth() - 5])
      : d3.scaleLinear()
          .domain([0, 1])
          .range([5, xScaleMultiple.bandwidth() - 5]);

    const y = d3.scaleLinear()
      .domain(d3.extent(dataset, d => d[prop]))
      .range([yScaleMultiple.bandwidth() - 5, 5]);

    return {
      ...scaleObj,
      [prop]: {
        x,
        y
      }
    };
  }, {});

  const borders = multiples.append('rect')
    .style('stroke-width', 1)
    .style('stroke', 'gray')
    .style('fill', 'none')
    .attr('width', xScaleMultiple.bandwidth())
    .attr('height', yScaleMultiple.bandwidth());

  d3.select('#multiples')
    .append("g")
    .style("font", "bold 10px sans-serif")
    .style("pointer-events", "none")
    .selectAll("text")
    .data(properties)
    .join("text")
    .attr('transform', d => `translate(${xScaleMultiple(d)}, ${yScaleMultiple(d)})`)
    .attr("x", 0.05 * xScaleMultiple.bandwidth())
    .attr("y", 10)
    .attr("dy", ".71em")
    .text(d => d);

  multiples.each(function ([prop1, prop2]) {
    d3.select(this).selectAll('.dot')
      .data(dataset)
      .join('circle')
      .classed('dot', true)
      .attr('cx', d => scales[prop1].x(d[prop1]))
      .attr('cy', d => scales[prop2].y(d[prop2]))
      .attr('r', 2);
  });

  const dots = multiples.selectAll('.dot');

  d3.select('#multiples')
    .on('keydown', () => {
      if (d3.event.ctrlKey) {
        d3.selectAll('.overlay')
          .style('pointer-events', 'none');
      }
    })
    .on('keyup', () => {
      d3.selectAll('.overlay')
        .style('pointer-events', 'all');
    });

  multiples.call(brush, {
    dots, 
    scales,
    width: xScaleMultiple.bandwidth(),
    height: yScaleMultiple.bandwidth()
  });

  d3.select('body')
    .on('keydown', async () => {
      if (d3.event.keyCode === 32) {
        const data = [...new Set(d3.selectAll('.highlighted').data())];
        
        const randomDatum = data[Math.floor(Math.random() * data.length)];
        console.log(randomDatum);
        await spotifyPlayTrack(randomDatum);
      }
    });
};


///
/////////
///////////////////////////////////////////////////////////////////////////////
/////////
///
const spotifyGET = async (path) => {
  const response = await fetch('https://api.spotify.com/v1' + path, {
    method: 'GET',
    mode: 'cors',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      // Replace the value in ./env.js with your spotify API token. 
      // Grab that with the "Get Token" button at https://developer.spotify.com/console/put-play
      'Authorization': `Bearer ${env.spotifyApiToken}`,
    }
  });

  // CAUTION: No error handling here
  return response.json();
}

const spotifyPlayTrack = async (track) => {debugger;
  await fetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    mode: 'cors',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      // Replace the value in ./env.js with your spotify API token. 
      // Grab that with the "Get Token" button at https://developer.spotify.com/console/put-play
      'Authorization': `Bearer ${env.spotifyApiToken}`,
    },
    body: JSON.stringify({
      "uris": [`spotify:track:${track.id}`]
    })
  });
}

const getTrackIds = async (playlistId) => {
  const response = await spotifyGET(`/playlists/${playlistId}/tracks?fields=items(track.id)`);

  return response.items.map(item => item.track.id);
};

const getTrackAudioFeatures = async (trackIds) => {
  const joinedIds = trackIds.join(',');

  const response = await spotifyGET(`/audio-features?ids=${joinedIds}`);

  return response.audio_features;
};

const getPlaylistName = async (playlistId) => {
  const response = await spotifyGET(`/playlists/${playlistId}`);

  return response.name;
};


const config = {
  w: 800,
  h: 600,
  margin: 40
};

(async () => {
  const waiting = d3.select('body')
    .append('text')
    .text('Waiting...');

  const playlistId = '70hK2YUZnBcsrO8bvkahPu';

  const trackIds = await getTrackIds(playlistId);
  const audioFeatures = (await getTrackAudioFeatures(trackIds))
    .filter(d => !!d);
  const playlistTitle = await getPlaylistName(playlistId);
debugger;
  waiting.remove();
  d3.select('#playlistTitle').text(playlistTitle);

  createVisualization(config, audioFeatures);
})();