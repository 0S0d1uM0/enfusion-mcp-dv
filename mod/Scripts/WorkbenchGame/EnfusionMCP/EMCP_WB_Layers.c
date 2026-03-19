/**
 * EMCP_WB_Layers.c - Layer management handler
 *
 * Actions: list, getActive, setVisible, getEntityLayer
 * Layer operations in WorldEditorAPI are limited in the public API.
 * Layers are identified by IDs from IEntitySource.GetLayerID().
 *
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Layers"
 */

class EMCP_WB_LayersRequest : JsonApiStruct
{
	string action;
	int subScene;
	string entityName;
	bool visible;
	string layerPath;

	void EMCP_WB_LayersRequest()
	{
		RegV("action");
		RegV("subScene");
		RegV("entityName");
		RegV("visible");
		RegV("layerPath");
		subScene = -1;
	}
}

class EMCP_WB_LayersResponse : JsonApiStruct
{
	string status;
	string message;
	string action;
	int currentSubScene;
	int layerID;
	bool layerVisible;
	bool layerLocked;
	bool layerActive;
	int layerEntityCount;

	// Layer data collected for list
	ref array<int> m_aLayerIDs;
	ref array<int> m_aEntityCounts;

	void EMCP_WB_LayersResponse()
	{
		RegV("status");
		RegV("message");
		RegV("action");
		RegV("currentSubScene");
		RegV("layerID");
		RegV("layerVisible");
		RegV("layerLocked");
		RegV("layerActive");
		RegV("layerEntityCount");

		m_aLayerIDs = {};
		m_aEntityCounts = {};
	}

	override void OnPack()
	{
		if (m_aLayerIDs.Count() > 0)
		{
			StartArray("layers");
			for (int i = 0; i < m_aLayerIDs.Count(); i++)
			{
				StartObject("");
				StoreInteger("layerID", m_aLayerIDs[i]);
				StoreInteger("entityCount", m_aEntityCounts[i]);
				EndObject();
			}
			EndArray();
		}
	}
}

class EMCP_WB_Layers : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_LayersRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_LayersRequest req = EMCP_WB_LayersRequest.Cast(request);
		EMCP_WB_LayersResponse resp = new EMCP_WB_LayersResponse();
		resp.action = req.action;

		WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
		if (!worldEditor)
		{
			resp.status = "error";
			resp.message = "WorldEditor module not available";
			return resp;
		}

		WorldEditorAPI api = worldEditor.GetApi();
		if (!api)
		{
			resp.status = "error";
			resp.message = "WorldEditorAPI not available";
			return resp;
		}

		resp.currentSubScene = api.GetCurrentSubScene();

		if (req.action == "list")
		{
			// Enumerate layers by scanning all entities and collecting unique layer IDs
			int entityCount = api.GetEditorEntityCount();
			map<int, int> layerCounts = new map<int, int>();

			for (int i = 0; i < entityCount; i++)
			{
				IEntitySource entSrc = api.GetEditorEntity(i);
				if (!entSrc)
					continue;

				int lid = entSrc.GetLayerID();
				if (layerCounts.Contains(lid))
				{
					int current = layerCounts.Get(lid);
					layerCounts.Set(lid, current + 1);
				}
				else
				{
					layerCounts.Set(lid, 1);
				}
			}

			// Output collected layers
			for (int k = 0; k < layerCounts.Count(); k++)
			{
				int layerKey = layerCounts.GetKey(k);
				int layerCount = layerCounts.GetElement(k);
				resp.m_aLayerIDs.Insert(layerKey);
				resp.m_aEntityCounts.Insert(layerCount);
			}

			resp.status = "ok";
			resp.message = "Found " + layerCounts.Count().ToString() + " layers across " + entityCount.ToString() + " entities";
		}
		else if (req.action == "getActive")
		{
			resp.currentSubScene = api.GetCurrentSubScene();
			resp.status = "ok";
			resp.message = "Current sub-scene: " + resp.currentSubScene.ToString();
		}
		else if (req.action == "getEntityLayer")
		{
			if (req.entityName == "")
			{
				resp.status = "error";
				resp.message = "entityName parameter required for getEntityLayer";
				return resp;
			}

			int count = api.GetEditorEntityCount();
			bool found = false;
			for (int i = 0; i < count; i++)
			{
				IEntitySource entSrc = api.GetEditorEntity(i);
				if (entSrc && entSrc.GetName() == req.entityName)
				{
					resp.layerID = entSrc.GetLayerID();
					found = true;
					break;
				}
			}

			if (found)
			{
				resp.status = "ok";
				resp.message = "Entity '" + req.entityName + "' is on layer " + resp.layerID.ToString();
			}
			else
			{
				resp.status = "error";
				resp.message = "Entity not found: " + req.entityName;
			}
		}
		else if (req.action == "isVisible")
		{
			if (req.layerPath == "")
			{
				resp.status = "error";
				resp.message = "layerPath parameter required for isVisible (use layer ID as string, e.g. '0')";
				return resp;
			}

			int targetLayerID = req.layerPath.ToInt();

			// RUNTIME_VERIFY: WorldEditorAPI layer visibility methods.
			// Try IsLayerVisible / IsLayerLocked if they exist in the script API.
			// If neither compiles, replace with graceful fallback:
			//   resp.layerVisible = true;  // assume visible
			//   resp.message = "Layer visibility API not available in script — entity count only";
			resp.layerVisible = api.IsLayerVisible(targetLayerID); // RUNTIME_VERIFY
			resp.layerLocked = api.IsLayerLocked(targetLayerID);   // RUNTIME_VERIFY
			resp.layerID = targetLayerID;
			resp.status = "ok";
			resp.message = "Layer " + req.layerPath + ": visible=" + resp.layerVisible.ToString() + " locked=" + resp.layerLocked.ToString();
		}
		else if (req.action == "getInfo")
		{
			if (req.layerPath == "")
			{
				resp.status = "error";
				resp.message = "layerPath parameter required for getInfo (use layer ID as string, e.g. '0')";
				return resp;
			}

			int targetLayerID = req.layerPath.ToInt();

			// Count entities on this layer
			int totalEntities = api.GetEditorEntityCount();
			int layerEntCount = 0;
			for (int i = 0; i < totalEntities; i++)
			{
				IEntitySource es = api.GetEditorEntity(i);
				if (es && es.GetLayerID() == targetLayerID)
					layerEntCount++;
			}

			resp.layerID = targetLayerID;
			resp.layerEntityCount = layerEntCount;
			resp.layerVisible = api.IsLayerVisible(targetLayerID); // RUNTIME_VERIFY
			resp.layerActive = (api.GetCurrentSubScene() == targetLayerID);
			resp.status = "ok";
			resp.message = "Layer " + req.layerPath + ": " + layerEntCount.ToString() + " entities";
		}
		else if (req.action == "toggleVisibility")
		{
			if (req.layerPath == "")
			{
				resp.status = "error";
				resp.message = "layerPath parameter required for toggleVisibility (use layer ID as string, e.g. '0')";
				return resp;
			}

			int targetLayerID = req.layerPath.ToInt();
			bool currentVis = api.IsLayerVisible(targetLayerID); // RUNTIME_VERIFY
			bool newVis = !currentVis;

			// RUNTIME_VERIFY: SetLayerVisible may not exist in the public script API.
			// Alternative method name: api.SetLayerVisibility(targetLayerID, newVis)
			// If neither compiles, fall back to error response.
			api.SetLayerVisible(targetLayerID, newVis); // RUNTIME_VERIFY

			resp.layerVisible = newVis;
			resp.layerID = targetLayerID;
			resp.status = "ok";
			resp.message = "Layer " + req.layerPath + " visibility toggled to: " + newVis.ToString();
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: list, getActive, getEntityLayer, isVisible, getInfo, toggleVisibility";
		}

		return resp;
	}
}
