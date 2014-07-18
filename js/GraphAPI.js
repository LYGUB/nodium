(function (window, $, undefined) {
	var graph = window.setNamespace('app.graph');

	graph.API = function (g) {

		// enforce use of new on constructor
		if ((this instanceof graph.API) === false) {
			return new graph.API(arguments);
		}

		// the graph instance it should listen to
		this.graph = g;

		var createNode = window.curry(this.handleNodeCreated, this);
		$(g).on('node-created', createNode);
		var deleteNode = window.curry(this.handleNodeDeleted, this);
		$(g).on('node-deleted', deleteNode);
		var createEdge = window.curry(this.handleEdgeCreated, this);
		$(g).on('edge-created', createEdge);
		var deleteEdge = window.curry(this.handleEdgeDeleted, this);
		$(g).on('edge-deleted', deleteEdge);
		var updateNode = window.curry(this.handleNodeUpdated, this);
		$(g).on('node-updated', updateNode);
	};

	graph.API.prototype.get = function (callback, addNodeMetadata) {

		// OPTIONAL MATCH n-[r]-m
		var nodeQuery = {
		  "query" : "START n=node(*) RETURN n",
		  "params" : {}
		};

		$.post('http://localhost:7474/db/data/cypher', nodeQuery)
		 .done(function (nodeData) {

	 	var edgeQuery = {
		  "query" : "START r=relationship(*) RETURN r",
		  "params" : {}
		};

		$.post('http://localhost:7474/db/data/cypher', edgeQuery)
		 .done(function (edgeData) {

		 	// console.log(data);
		 	// parse the neo4j data
		 	var graph,
		 		nodes = [],
		 		edges = [],
		 		node, nodeId,
		 		edge,
		 		nodeMap = {},
		 		nodeCount = 0;

		 	if (!nodeData.data) {
		 		return;
		 	}

		 	// build the nodes array and the index map
		 	for (var i = 0; i < nodeData.data.length; i++) {
		 		node = nodeData.data[i][0];

		 		if (!node || nodeMap[node.self] !== undefined) {
		 			continue;
		 		}

		 		addNodeMetadata(node.data);

		 		nodeMap[node.self] = nodeCount;
		 		nodeCount++;

		 		node.data.id = node.self;
		 		nodes.push(node.data);
		 	}

		 	// convert the edges to an array of d3 edges,
		 	// which have node indices as source and target
		 	console.log()
		 	for (var i = 0; i < edgeData.data.length; i++) {
		 		edge = edgeData.data[i][0];

		 		if (!edge) {
		 			continue;
		 		}

		 		edges.push({
		 			id: edge.self,
		 			source: nodeMap[edge.start],
		 			target: nodeMap[edge.end]
		 		});
		 	}

		 	// console.log(nodes);

		 	graph = {
		 		nodes: nodes,
		 		edges: edges
		 	};

		 	callback(graph);
		 });
		});
	};

	/**
	 * Create a node in the neo4j database
	 * Store the id to easily delete the node later
	 */
	graph.API.prototype.handleNodeCreated = function (event, data, callback) {

		var props = this.graph.getCleanNodeData(data);

		$.post('http://localhost:7474/db/data/node', props)
		 .done(function (result) {
		 	console.log(result);
		 	data.id = result.self;

		 	console.log(data);

		 	if (callback) {
		 		callback(result);
		 	}
		 });
	};

	/**
	 * We're doing this with a cypher, because we also have to delete
	 * all relationships
	 */
	graph.API.prototype.handleNodeDeleted = function (event, data) {

		console.log("deleting neo4j node");

		var nodeId,
			index,
			query;

		index = data.id.lastIndexOf('/');
		if (index == -1) {
			return;
		}

		nodeId = data.id.substring(index+1, data.id.length);

		// TODO this query should work, but can't find parameter nodeId
		// query = {
		//  	"query" : "START n=node({nodeId}) OPTIONAL MATCH n-[r]-() DELETE n,r",
		//  	"params" : {
		//  		"nodeId": nodeId
		// 	}
		// };
		query = {
		 	"query" : "START n=node("+nodeId+") OPTIONAL MATCH n-[r]-() DELETE n,r",
		 	"params" : {}
		};


		console.log(query);

		$.post('http://localhost:7474/db/data/cypher', query)
		 .done(function (result) {
		 	console.log(result);
		});
	};

	graph.API.prototype.handleEdgeCreated = function (event, data, source, target) {

		console.log("creating neo4j edge");
		console.log(data);

		var props = {
			to: target.id,
			type: "POINTS"
		};

		$.post(source.id+'/relationships', props)
		 .done(function (result) {
		 	console.log(result);
		 	data['id'] = result.self;
		 });
	};

	graph.API.prototype.handleEdgeDeleted = function (event, data) {

		console.log("deleting neo4j edge");
		console.log(data.id);

		$.ajax({
			url: data.id,
			type: 'DELETE'
		})
		.done(function (result) {
		 	console.log(result);
		});
	};

	graph.API.prototype.handleNodeUpdated = function (event, data, id) {

		console.log("handling node update");
		console.log(id);
		console.log(data);

		$.ajax({
			url: id + '/properties',
			type: 'PUT',
			data: data
		})
		.done(function (result) {
		 	console.log(result);
		});
	};

}(window, jQuery));